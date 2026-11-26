// @harness-uid u_hcvkvdj37h
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { assignTrackerLaunches } from '../tracker-machine-service/assignTrackerLaunches';
import { placeTrackerAutoLaunch } from '../tracker-machine-service/placeTrackerAutoLaunch';
import type { TrackerFleetView } from '../tracker-machine-service/trackerLaunchPlacement.types';
import type { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type { TrackerMachineService } from '../TrackerMachineService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import { composeTrackerTelemetry } from './nativeTrackerTelemetry';
import { recordingFleetStore } from './trackerFleetTelemetry';

/** Wire fleet telemetry, placement of `auto` launches and the hub's assignment of the rest. */
export function composeTrackerFleet(
	runs: TrackerRunReadRepository,
	options: TrackerNativeRuntimeOptions,
	runtime: {
		machines: TrackerMachineService;
		scheduler?: TrackerDispatchSchedulerService;
		now: () => number;
	}
) {
	const { machines, scheduler, now } = runtime;
	const received = options.syncResponder?.machines;
	const fleet = received && recordingFleetStore(received, machines);
	const telemetry = composeTrackerTelemetry(machines.store, runs, options, {
		machines,
		fleet,
		scheduler
	});
	const view: TrackerFleetView = { machines, now, samples: () => telemetry.samples?.() ?? [] };
	return {
		samples: telemetry.samples,
		tick: withAssignment(telemetry.tick, view, options),
		syncOptions: fleet
			? { ...options, syncResponder: { ...options.syncResponder!, machines: fleet } }
			: options,
		apiOptions: (api: TrackerNativeRuntimeOptions): TrackerNativeRuntimeOptions =>
			api.planLaunch ? { ...api, planLaunch: placeTrackerAutoLaunch(api.planLaunch, view) } : api
	};
}

function withAssignment(
	tick: ((signal: AbortSignal) => Promise<void>) | undefined,
	view: TrackerFleetView,
	{ role, dispatch }: TrackerNativeRuntimeOptions
) {
	if (!tick || role !== 'hub' || !dispatch) return tick;
	return async (signal: AbortSignal) => {
		await tick(signal);
		signal.throwIfAborted();
		assignTrackerLaunches(view);
	};
}
