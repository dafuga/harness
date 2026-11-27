// @harness-uid u_dq6rdp5vsp
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { trackerDiskAlertFloor } from '../../../utils/projects-sessions/trackerMachineStatus';
import type { TrackerOverloadState } from '../../../repositories/projects-sessions/TrackerMachineRepository.types';
import { planTrackerItemMutation } from '../../../utils/projects-sessions/planTrackerItemMutation';
import type {
	TrackerMachineRow,
	TrackerProcessGroup,
	TrackerSystemProcessGroup,
	TrackerResourceSample,
	TrackerWorkKind
} from '../../../utils/projects-sessions/trackerMachine.types';
import {
	itemMutation,
	itemMutationContext
} from '../tracker-local-api-service/trackerLocalItemMutation';
import {
	recordWatchdogAlert,
	trackerOverloadAlertKind
} from '../tracker-native-runtime-service/trackerHostWatchdogAlerts';
import { readWatchdogAlerts } from '../tracker-native-runtime-service/trackerHostWatchdogState';
import type { TrackerMachineService } from '../TrackerMachineService';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';

const minute = 60_000;
/** Resolve the alert after ten minutes of continuing healthy samples. */
const recovery = 10 * minute;

const sampleGap = 150_000;

export function trackerOverloadTitle(node: string): string {
	return `Computer overloaded: ${node}`;
}

/**
 * Raise one Chief of Staff item and alert for a sustained overload, and close both once the
 * computer has been calm. It never asks Daniel. An offline computer keeps its state.
 */
export function checkTrackerOverloads(machines: TrackerMachineService, now: number): void {
	for (const row of machines.rows()) {
		if (!row.sample || row.status === 'offline' || (row.age_s ?? Infinity) > sampleGap / 1000)
			continue;
		const state = contiguousState(machines, row.node, now);
		const next =
			row.status === 'overloaded'
				? whileOverloaded(machines, row, { state, now })
				: whileCalm(machines.store, row, { state, now });
		machines.repository.saveOverloadState(row.node, next);
	}
}

function contiguousState(machines: TrackerMachineService, node: string, now: number) {
	const state = machines.repository.overloadState(node);
	const readings = machines.repository.recent(node, now);
	let start = Date.parse(readings.at(-1)?.at ?? '');
	for (const reading of readings.slice(0, -1).reverse()) {
		const at = Date.parse(reading.at);
		if (start - at > sampleGap) break;
		start = at;
	}
	if (state.over_since !== null && state.over_since < start) state.over_since = null;
	if (state.calm_since !== null && state.calm_since < start) state.calm_since = null;
	return state;
}

function whileOverloaded(
	machines: TrackerMachineService,
	row: TrackerMachineRow,
	{ state, now }: { state: TrackerOverloadState; now: number }
): TrackerOverloadState {
	const observedAt = row.sample ? Date.parse(row.sample.at) : now;
	const overSince = state.over_since ?? observedAt;
	const next = { ...state, over_since: overSince, calm_since: null };
	if (state.flagged_item) return next;
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
			reason: overloadReason(machines, row)
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
	const observedAt = row.sample ? Date.parse(row.sample.at) : now;
	const calmSince = state.calm_since ?? observedAt;
	if (observedAt - calmSince < recovery)
		return { over_since: null, calm_since: calmSince, flagged_item: state.flagged_item };
	clearAlert(store, row.node);
	const items = new TrackerItemReadRepository(store.database);
	const open = overloadItems(store, trackerOverloadTitle(row.node)).find(
		({ id, status }) => id === state.flagged_item && status !== 'done' && status !== 'ignored'
	);
	if (open) {
		const note = `${row.node} back to ${row.status} for ${recovery / minute} min`;
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

function overloadReason(machines: TrackerMachineService, row: TrackerMachineRow) {
	const lead = `${row.node} is overloaded: ${row.reasons.join('; ')}.`;
	if (!row.sample) return lead;
	const { sample } = row;
	const cpu = highest(sample.top_cpu, sample.system_cpu ?? [], 'cpu');
	const memory = highest(sample.top_rss, sample.system_rss ?? [], 'rss_mb');
	const ranked = new Set([...cpu, ...memory].map(({ pid }) => pid));
	const groups = sample.system_groups?.filter(({ pid }) => !ranked.has(pid)) ?? [];
	const moving = sample.top_cpu.find(({ pid }) => pid === cpu[0]?.pid);
	return [
		lead,
		groups.length &&
			`Process groups: ${groups.map(({ label, procs }) => `${label} (${procs} procs)`).join(', ')}.`,
		cpu.length &&
			`Top CPU: ${cpu.map(({ label, cpu, procs }) => `${label} (${cpu}%, ${procs} procs)`).join(', ')}.`,
		memory.length &&
			`Top memory: ${memory.map(({ label, rss_mb }) => `${label} (${rss_mb} MB)`).join(', ')}.`,
		diskUsers(sample),
		moving && suggestedMove(machines, row.node, moving)
	]
		.filter(Boolean)
		.join(' ');
}

function highest(
	agents: TrackerProcessGroup[],
	system: TrackerSystemProcessGroup[],
	metric: 'cpu' | 'rss_mb'
) {
	return [...agents, ...system].sort((left, right) => right[metric] - left[metric]).slice(0, 2);
}

function diskUsers(sample: TrackerResourceSample): string {
	const users = sample.disk_users ?? [];
	if (users.length)
		return `Largest sampled disk users: ${users.map(({ label, used_gb }) => `${label} (${used_gb} GB)`).join(', ')}.`;
	return sample.disks.some(({ free_gb }) => free_gb < trackerDiskAlertFloor(sample.platform))
		? 'Disk usage breakdown unavailable.'
		: '';
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
