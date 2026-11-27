// @harness-uid u_bl6xl2h4a3
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
import { recordWatchdogAlert } from './trackerHostWatchdogAlerts';
import { TrackerDispatcherService } from '../../agents-providers/TrackerDispatcherService';
import type { TrackerDispatchPolicy } from '../../agents-providers/TrackerDispatcherService.types';
type AreaPermit = (
	item: TrackerDispatchItem,
	start: Pick<TrackerReservedStart, 'key' | 'run'>
) => Promise<{ allowed: boolean; reason: string }>;

/** Only a start decision leaves SQLite for a fleet claim. Re-evaluate eligibility before committing it. */
export function guardedDispatchStore(
	repository: TrackerDispatchRepository,
	permit: AreaPermit
): TrackerDispatchStore {
	return {
		async update(id, decide) {
			let candidate: { item: TrackerDispatchItem; run: TrackerRunReceipt } | undefined;
			const preview = await repository.update(id, (snapshot) => {
				const decision = decide(snapshot);
				const run = enteringRun(decision, snapshot);
				if (!run || !snapshot.item) return decision;
				candidate = { item: snapshot.item, run };
				return { result: decision.result };
			});
			if (!candidate) return preview;
			const { item, run } = candidate;
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
					areaInputs(snapshot.item) !== areaInputs(item)
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

export function trackerAreaDispatch(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions
) {
	const { commands, inspect } = trackerAreaCommands(store, options);
	const brief = new Map<string, string>();
	const permit: AreaPermit = async (item, start) => {
		const { allowed: granted, reason } = await inspect(item, {
			token: start.run.auto_token,
			attempt: start.run.attempt
		});
		const key = 'tracker_area_wait:' + item.id;
		const previous = store.getMeta(key);
		if (granted) {
			brief.set(
				start.key,
				[
					reason,
					previous ? 'Previous sibling order: ' + previous : 'Overlapping siblings: none.',
					'Edit only the claimed paths. Use tracker claim ' +
						item.id +
						' <path...> before extending the work or resuming edits after a block or stop.',
					'Land the PR through the repository queue with tracker land ' +
						item.id +
						' <PR>. It rebases and submits bun run check --item for the exact head. Full checks go through the same service with --release only for the combined release.'
				].join('\n')
			);
		} else if (previous !== reason) {
			recordWatchdogAlert(
				store,
				{ itemId: item.id, kind: 'cos-message', reason, identity: reason },
				options.now?.() ?? Date.now()
			);
			store.writeMeta({ [key]: reason });
		}
		return { allowed: granted, reason };
	};
	return {
		commands,
		permit,
		takeBrief(key: string) {
			const line = brief.get(key);
			brief.delete(key);
			return line;
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
		guard ? guardedDispatchStore(repository, guard.permit) : repository,
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
					[guard.takeBrief(reservation.key), instructions].filter(Boolean).join('\n\n')
				)
		}
	};
}
