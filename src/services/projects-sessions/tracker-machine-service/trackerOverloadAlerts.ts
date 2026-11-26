// @harness-uid u_dq6rdp5vsp
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerOverloadState } from '../../../repositories/projects-sessions/TrackerMachineRepository.types';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import type {
	TrackerMachineRow,
	TrackerProcessGroup,
	TrackerWorkKind
} from '../../../utils/projects-sessions/trackerMachine.types';
import {
	itemMutation,
	itemMutationContext
} from '../tracker-local-api-service/trackerLocalItemMutation';
import { recordWatchdogAlert } from '../tracker-native-runtime-service/trackerHostWatchdogAlerts';
import { readWatchdogAlerts } from '../tracker-native-runtime-service/trackerHostWatchdogState';
import type { TrackerMachineService } from '../TrackerMachineService';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

const minute = 60_000;
/** An overload must last this long before it is raised, and calm this long before it closes. */
const sustained = 10 * minute;

export const trackerOverloadAlertKind = 'overload';

export function trackerOverloadTitle(node: string): string {
	return `Computer overloaded: ${node}`;
}

/**
 * Raise one Chief of Staff item and alert for a sustained overload, and close both once the
 * computer has been calm. It never asks Daniel. An offline computer keeps its state.
 */
export function checkTrackerOverloads(machines: TrackerMachineService, now: number): void {
	for (const row of machines.rows()) {
		if (row.status === 'offline') continue;
		const state = machines.repository.overloadState(row.node);
		const next =
			row.status === 'overloaded'
				? whileOverloaded(machines, row, { state, now })
				: whileCalm(machines.store, row, { state, now });
		machines.repository.saveOverloadState(row.node, next);
	}
}

function whileOverloaded(
	machines: TrackerMachineService,
	row: TrackerMachineRow,
	{ state, now }: { state: TrackerOverloadState; now: number }
): TrackerOverloadState {
	const overSince = state.over_since ?? now;
	const next = { ...state, over_since: overSince, calm_since: null };
	if (state.flagged_item || now - overSince < sustained) return next;
	const title = trackerOverloadTitle(row.node);
	const existing = overloadItems(machines.store, title);
	// An ignored overload item stays ignored.
	if (existing.some(({ status }) => status === 'ignored')) return next;
	const itemId =
		existing.find(({ status }) => status !== 'done')?.id ?? addItem(machines.store, title, now);
	recordWatchdogAlert(
		machines.store,
		{
			itemId,
			key: `${trackerOverloadAlertKind}:${row.node}`,
			kind: trackerOverloadAlertKind,
			host: row.node,
			identity: `${row.node}:${overSince}`,
			reason: overloadReason(machines, row, Math.round((now - overSince) / minute))
		},
		now
	);
	return { ...next, flagged_item: itemId };
}

function whileCalm(
	store: TrackerPersistenceService,
	row: TrackerMachineRow,
	{ state, now }: { state: TrackerOverloadState; now: number }
): TrackerOverloadState {
	const cleared = { over_since: null, calm_since: null, flagged_item: null };
	if (!state.flagged_item) return cleared;
	const calmSince = state.calm_since ?? now;
	if (now - calmSince < sustained)
		return { over_since: null, calm_since: calmSince, flagged_item: state.flagged_item };
	clearAlert(store, row.node);
	const items = new TrackerItemReadRepository(store.database);
	const open = overloadItems(store, trackerOverloadTitle(row.node)).find(
		({ id, status }) => id === state.flagged_item && status !== 'done' && status !== 'ignored'
	);
	if (open) {
		const note = `${row.node} back to ${row.status} for ${sustained / minute} min`;
		const plan = planTrackerItemMutation(
			{ action: 'done', item: items.resolve(open.id), body: { note } },
			{ ...itemMutationContext(store, items, { now: () => now }) }
		);
		if (plan.fields) store.appendLocal({ itemId: open.id, fields: plan.fields });
	}
	return cleared;
}

function clearAlert(store: TrackerPersistenceService, node: string): void {
	const alerts = readWatchdogAlerts(store);
	delete alerts[`${trackerOverloadAlertKind}:${node}`];
	store.writeMeta({ watchdog_alerts: JSON.stringify(alerts) });
}

function overloadItems(store: TrackerPersistenceService, title: string) {
	return store.database
		.prepare('SELECT id, status FROM items WHERE title = ? AND deleted = 0')
		.all(title) as { id: string; status: string }[];
}

function addItem(store: TrackerPersistenceService, title: string, now: number): string {
	const items = new TrackerItemReadRepository(store.database);
	// `later` keeps the launcher from starting a session for an alert.
	const body = { title, agent: 'tracker', owner: 'Chief of Staff', later: true, force: true };
	const plan = planTrackerItemMutation(
		itemMutation('add', '', body, items),
		itemMutationContext(store, items, { now: () => now })
	);
	if (plan.fields) store.appendLocal({ itemId: plan.itemId, fields: plan.fields });
	return plan.itemId;
}

function overloadReason(machines: TrackerMachineService, row: TrackerMachineRow, minutes: number) {
	const lead = `${row.node} has been overloaded for ${minutes} min: ${row.reasons.join('; ')}.`;
	const heavy = heaviest(row);
	const [first] = heavy;
	if (!first) return `${lead} No agent sessions found; the load comes from other processes.`;
	const listed = heavy
		.map((group) => `${group.label} (cpu ${group.cpu}%, ${group.rss_mb} MB, ${group.procs} procs)`)
		.join(', ');
	return `${lead} Heaviest: ${listed}. ${suggestedMove(machines, row.node, first)}`;
}

function heaviest(row: TrackerMachineRow): TrackerProcessGroup[] {
	const groups = [...(row.sample?.top_cpu ?? []), ...(row.sample?.top_rss ?? [])];
	return [...new Map(groups.map((group) => [group.pid, group])).values()]
		.sort((left, right) => right.cpu - left.cpu || right.rss_mb - left.rss_mb)
		.slice(0, 3);
}

function suggestedMove(machines: TrackerMachineService, node: string, group: TrackerProcessGroup) {
	const kinds: Record<TrackerProcessGroup['kind'], TrackerWorkKind> = {
		claude: 'claude',
		codex: 'codex',
		'test-runner': 'build',
		browser: 'browser-tests'
	};
	const placement = machines.place({
		kind: kinds[group.kind],
		needsRamGB: Math.max(1, group.rss_mb / 1024),
		exclude: [node]
	});
	const target = placement.ranked.find(({ node: name }) => name === placement.recommended);
	return target
		? `Suggested move: ${group.label} to ${target.node} (${target.reasons.join('; ')}).`
		: 'No other computer has room right now; consider pausing or finishing the heaviest session.';
}
