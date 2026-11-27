// @harness-uid u_wlip653voz
import type { TrackerAdapterReadQuery } from '../TrackerAdapterPollService.types';

export interface TrackerMessageReadOptions {
	query: TrackerAdapterReadQuery;
	dryRun: boolean;
	preview?: boolean;
}
