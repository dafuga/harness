// @harness-uid u_qfqdniiemw
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerLadderConfig } from '../../../utils/agents-providers/parseTrackerModelSpec.types';
import { pickTrackerModelFromRuns } from '../../../utils/agents-providers/pickTrackerModelFromRuns';
import { retryTrackerModel } from '../../../utils/agents-providers/pickTrackerModel';
import { redirectTrackerRung } from '../../../utils/agents-providers/redirectTrackerRung';
import type {
	TrackerDispatchItem,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerHostLaunchConfig } from './nativeTrackerHostEffects.types';
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
	return {
		maxRetries,
		defaultEtaMinutes,
		stallMinutes,
		maxRunMinutes,
		pickModel(item: TrackerDispatchItem) {
			try {
				return pickTrackerModelFromRuns(item, () => history.finished(), selection());
			} catch {
				return { error: 'Tracker model cannot be selected for this task' };
			}
		},
		retryModel: (item: TrackerDispatchItem, run: TrackerRunReceipt) =>
			retryTrackerModel(item, run, selection()),
		redirectPick: (item: TrackerDispatchItem, rung: { cli: string; model: string }) =>
			redirectTrackerRung(item, rung, selection())
	};
}
