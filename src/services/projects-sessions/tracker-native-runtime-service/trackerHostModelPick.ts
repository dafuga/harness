// @harness-uid u_qfqdniiemw
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerLadderConfig } from '../../../utils/agents-providers/parseTrackerModelSpec.types';
import { pickTrackerModelFromRuns } from '../../../utils/agents-providers/pickTrackerModelFromRuns';
import { retryTrackerModel } from '../../../utils/agents-providers/retryTrackerModel';
import { redirectTrackerRung } from '../../../utils/agents-providers/redirectTrackerRung';
import { trackerTaskType } from '../../../utils/agents-providers/trackerTaskType';
import type {
	TrackerDispatchItem,
	TrackerRetryAttempt
} from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerHostLaunchConfig } from './nativeTrackerHostEffects.types';
import { trackerItemModelEvidence } from './trackerItemModelEvidence';
import { trackerClaudePreferredUntil } from './trackerProviderPreference';

/**
 * Model selection and run limits for one host. Unset limits keep the dispatcher's defaults.
 * Launches learn from the same local and replicated attempts that `tracker pick` reads.
 */
export function trackerHostModelPolicy(
	store: TrackerPersistenceService,
	config: TrackerHostLaunchConfig,
	{ ladderConfig, now }: { ladderConfig?: TrackerLadderConfig; now?: () => number }
) {
	const history = new TrackerRunReadRepository(store.database, store.node);
	const items = new TrackerItemReadRepository(store.database, now);
	const { maxRetries, defaultEtaMinutes, stallMinutes, maxRunMinutes } = config;
	// Read on every choice: the operator can turn the preference on or off while launches wait.
	const selection = () => {
		const at = now?.() ?? Date.now();
		return {
			cfg: ladderConfig,
			now: at,
			claudePreferredUntil: trackerClaudePreferredUntil(store, at)
		};
	};
	// A retry is chosen before its failed attempt is saved, so that attempt joins the history.
	const withEvidence = (item: TrackerDispatchItem, failing?: TrackerRetryAttempt) => {
		const runs = history
			.list({ itemId: item.id })
			.filter(({ id, node }) => !(failing?.id === id && failing.node === node));
		const evidence = trackerItemModelEvidence(runs, items.getStored(item.id).notes_log);
		if (failing) {
			const { model, effort = null } = failing;
			evidence.failed = [...evidence.failed, { model, effort }];
		}
		return { ...selection(), evidence };
	};
	return {
		maxRetries,
		defaultEtaMinutes,
		stallMinutes,
		maxRunMinutes,
		taskType: (item: TrackerDispatchItem) => trackerTaskType(item),
		pickModel(item: TrackerDispatchItem) {
			try {
				return pickTrackerModelFromRuns(item, () => history.finished(), withEvidence(item));
			} catch {
				return { error: 'Tracker model cannot be selected for this task' };
			}
		},
		retryModel: (item: TrackerDispatchItem, run: TrackerRetryAttempt) =>
			retryTrackerModel(item, run, withEvidence(item, run)),
		redirectPick: (
			item: TrackerDispatchItem,
			rung: { cli: string; model: string; effort?: string | null }
		) => redirectTrackerRung(item, rung, withEvidence(item))
	};
}
