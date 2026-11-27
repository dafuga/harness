// @harness-uid u_wlip653voz
import type { TrackerAdapterSourceRepository } from '../../../repositories/projects-sessions/TrackerAdapterSourceRepository';
import type { TrackerAdapterLease } from '../TrackerAdapterPollService.types';

export type TrackerAdapterOwner = {
	sources: TrackerAdapterSourceRepository;
	lease: TrackerAdapterLease;
	node: string;
};
