// @harness-uid u_wlip653voz
import type { TrackerPersistenceService } from './TrackerPersistenceService';
import type {
	TrackerAdapterPollDependencies,
	TrackerAdapterPollOptions,
	TrackerAdapterPollResult
} from './TrackerAdapterPollService.types';

export class TrackerAdapterPollService {
	constructor(_store: TrackerPersistenceService, _dependencies: TrackerAdapterPollDependencies) {}

	async poll(
		_id: string,
		_options: TrackerAdapterPollOptions = {}
	): Promise<TrackerAdapterPollResult> {
		throw new Error('Tracker adapter polling is unavailable');
	}
}
