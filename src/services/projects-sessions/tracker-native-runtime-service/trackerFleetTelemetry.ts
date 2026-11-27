// @harness-uid u_yyzz3xrixn
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type { TrackerHubMachineStore } from '../TrackerHubSyncService.types';
import type { TrackerMachineService } from '../TrackerMachineService';
import { checkTrackerOverloads } from '../tracker-machine-service/trackerOverloadAlerts';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';

const interval = 60_000;

/** The hub's fleet store, also recording the resource readings its peers report. */
export function recordingFleetStore(
	fleet: TrackerHubMachineStore,
	machines: TrackerMachineService
): TrackerHubMachineStore {
	return {
		record(sample) {
			fleet.record(sample);
			machines.ingest([sample]);
		},
		latestSamples: () => fleet.latestSamples()
	};
}

/** The hub adds its own sample to the fleet and watches every computer for overload. */
export function hubTelemetryTick({
	fleet,
	machines,
	runs,
	scheduler,
	options
}: {
	fleet: TrackerHubMachineStore;
	machines: TrackerMachineService;
	runs: TrackerRunReadRepository;
	scheduler?: TrackerDispatchSchedulerService;
	options: TrackerNativeRuntimeOptions;
}) {
	if (!options.machineSampler) return undefined;
	const now = options.now ?? Date.now;
	const raiseAlerts = options.hostEffects?.watchdog?.chiefOfStaff === true;
	let next = -Infinity;
	return async (signal: AbortSignal) => {
		if (now() < next) return;
		next = now() + interval;
		// A failed reading must not stop the launcher report or the peers' overload checks.
		const resources = await machines.sampleLocal().catch(() => undefined);
		signal.throwIfAborted();
		const runner = scheduler?.runnerStatus() ?? { enabled: false };
		const active = runs.activeLocal().filter(({ state }) => state !== 'queued').length;
		fleet.record({
			node: options.node,
			at: new Date(now()).toISOString(),
			runner: { ...runner, active },
			host_work: machines.localHostWork(),
			resources
		});
		if (raiseAlerts) checkTrackerOverloads(machines, now());
	};
}
