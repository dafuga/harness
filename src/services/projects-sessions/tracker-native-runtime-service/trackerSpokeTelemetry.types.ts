// @harness-uid u_ac655bcttp
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type { TrackerMachineService } from '../TrackerMachineService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';

export type SpokeLink = NonNullable<TrackerNativeRuntimeOptions['links']>[number];

export type Active = ReturnType<TrackerRunReadRepository['activeLocal']>;

export type SpokeTelemetry = {
	machines: TrackerMachineService;
	runs: TrackerRunReadRepository;
	scheduler?: TrackerDispatchSchedulerService;
	options: TrackerNativeRuntimeOptions;
};
