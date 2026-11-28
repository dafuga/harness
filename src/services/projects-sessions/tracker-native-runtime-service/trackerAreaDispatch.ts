// @harness-uid u_bl6xl2h4a3
import type { AreaPermit } from './trackerAreaDispatch.types';
import type {
	TrackerDispatchStore,
	TrackerDispatchItem
} from '../../agents-providers/TrackerDispatcherService.types';
import type {
	TrackerDispatchDecision,
	TrackerDispatchSnapshot,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService.types';
import { attemptKey } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerDispatchRepository } from '../../../repositories/projects-sessions/TrackerDispatchRepository';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type {
	TrackerReservedStart,
	TrackerDispatchRunner
} from '../TrackerDispatchSchedulerService.types';
import { trackerAreaCommands } from './trackerAreaCommands';
import type { AreaDecision } from '../tracker-hub-sync/trackerAreaClaim.types';
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';
import { TrackerDispatcherService } from '../../agents-providers/TrackerDispatcherService';
import type { TrackerDispatchPolicy } from '../../agents-providers/TrackerDispatcherService.types';
/** Only a start decision leaves SQLite for a fleet claim. Re-evaluate eligibility before committing it. */
export function guardedDispatchStore(
	repository: TrackerDispatchRepository,
	permit: AreaPermit,
	history: (id: string) => string
): TrackerDispatchStore {
	return {
		async update(id, decide) {
			let candidate:
				| { item: TrackerDispatchItem; run: TrackerRunReceipt; history: string }
				| undefined;
			const preview = await repository.update(id, (snapshot) => {
				const decision = decide(snapshot);
				const run = enteringRun(decision, snapshot);
				if (!run || !snapshot.item) return decision;
				candidate = { item: snapshot.item, run, history: history(id) };
				return { result: decision.result };
			});
			if (!candidate) return preview;
			const { item, run, history: plannedNotes } = candidate;
			const key = attemptKey(run);
			const response = await permit(item, { key, run });
			if (!response.allowed) return { status: 'held', reason: response.reason };
			return repository.update(id, (snapshot) => {
				const decision = decide(snapshot);
				const next = enteringRun(decision, snapshot);
				if (!next) return decision;
				if (
					attemptKey(next) !== key ||
					!snapshot.item ||
					areaInputs(snapshot.item) !== areaInputs(item) ||
					plannedNotes !== history(id)
				)
					return {
						result: { status: 'held', reason: 'Tracker item changed while claiming its areas' }
					};
				return decision;
			});
		}
	};
}

function enteringRun(decision: TrackerDispatchDecision, snapshot: TrackerDispatchSnapshot) {
	const { result } = decision;
	if (result.status === 'start') return result.run;
	if (
		result.status === 'recorded' &&
		result.run.state === 'running' &&
		snapshot.runs.some(
			(r) => r.id === result.run.id && r.node === result.run.node && r.outcome === 'blocked'
		)
	)
		return result.run;
	return undefined;
}

function areaInputs(item: TrackerDispatchItem) {
	return JSON.stringify([item.title, item.notes, item.project, item.agent, item.repo, item.launch]);
}

/** Warnings travel in the brief only; an item note would change the history being admitted. */
function admissionBrief(id: string, { reason, recorded, warnings }: AreaDecision, waits: string[]) {
	const quiet = !warnings.length && 'Overlapping siblings: none.';
	return [
		reason,
		warnings.length && ['Area warnings (they did not hold this launch):', ...warnings].join('\n- '),
		waits.length ? 'Previous sibling order: ' + waits.join(' → ') : quiet,
		recorded
			? `Edit only the claimed paths. Use tracker claim ${id} <path...> before extending the work or resuming edits after a block or stop.`
			: `No areas are claimed for this start. Run tracker claim ${id} <path...> before editing, and again after a block or stop.`,
		`Land through the repository queue with tracker land ${id} <PR>. It rebases and submits the exact candidate to the shared check service. Full checks are reserved for the combined release.`
	]
		.filter(Boolean)
		.join('\n');
}

export function trackerAreaDispatch(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions
) {
	const { commands, inspect, history } = trackerAreaCommands(store, options);
	const permit: AreaPermit = async (item, start) => {
		const decision = await inspect(item, {
			token: start.run.auto_token,
			attempt: start.run.attempt
		});
		const { allowed: granted, reason } = decision;
		const receiptKey = 'tracker_area_admission:' + item.id;
		const raw = store.getMeta(receiptKey);
		const last = raw
			? (JSON.parse(raw) as { key: string; waits: string[]; brief?: string })
			: undefined;
		const waits = last?.key === start.key ? last.waits : [];
		if (granted) {
			const brief = admissionBrief(item.id, decision, waits);
			store.writeMeta({ [receiptKey]: JSON.stringify({ key: start.key, waits, brief }) });
		} else if (!waits.includes(reason)) {
			recordWatchdogAlert(
				store,
				{ itemId: item.id, kind: 'cos-message', reason, identity: reason },
				options.now?.() ?? Date.now()
			);
			store.writeMeta({
				[receiptKey]: JSON.stringify({ key: start.key, waits: [...waits, reason] })
			});
		}
		return { allowed: granted, reason };
	};
	return {
		commands,
		history,
		permit,
		briefFor(start: TrackerReservedStart) {
			const raw = store.getMeta('tracker_area_admission:' + start.run.item_id);
			const record = raw ? (JSON.parse(raw) as { key: string; brief?: string }) : undefined;
			if (record?.key === start.key && record.brief) return record.brief;
			return `No area check is recorded for this start. Run tracker claim ${start.run.item_id} <path...> before editing.`;
		}
	};
}

export function areaDispatchServices(
	repository: TrackerDispatchRepository,
	policy: TrackerDispatchPolicy,
	guard: ReturnType<typeof trackerAreaDispatch> | undefined,
	runner: TrackerDispatchRunner
) {
	const dispatch = new TrackerDispatcherService(
		guard ? guardedDispatchStore(repository, guard.permit, guard.history) : repository,
		policy
	);
	if (!guard) return { dispatch, runner };
	return {
		dispatch,
		runner: {
			...runner,
			start: (reservation: TrackerReservedStart, signal: AbortSignal, instructions: string) =>
				runner.start(
					reservation,
					signal,
					[guard.briefFor(reservation), instructions].filter(Boolean).join('\n\n')
				)
		}
	};
}
