// @harness-uid u_bl6xl2h4a3
import type { z } from 'zod';
import type { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type { TrackerMachineService } from '../TrackerMachineService';
import type { TrackerHubMachineStore } from '../TrackerHubSyncService.types';
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerSpokeLoopService } from '../TrackerSpokeLoopService';
import { observeTrackerDuePolicy } from './nativeTrackerDuePolicy';
import { trackerMachineSample } from './trackerFleetSampleSchema';

export { trackerMachineSample, trackerRunnerSample } from './trackerFleetSampleSchema';

export function composeTrackerLinks(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions
) {
	return (options.links ?? []).map(
		(link) =>
			new TrackerSpokeLoopService({
				now: options.now,
				...link,
				store,
				onDuePolicy(value) {
					if ((link.link ?? 'hub') === 'hub') observeTrackerDuePolicy(store, value);
					link.onDuePolicy?.(value);
				}
			})
	);
}

/** Spokes see the hub only if its machine list carries the hub's own current report too. */
export function trackerHubMachines(
	machines: TrackerHubMachineStore,
	runs: TrackerRunReadRepository,
	options: TrackerNativeRuntimeOptions,
	{
		machines: machineService,
		scheduler
	}: { machines: TrackerMachineService; scheduler?: TrackerDispatchSchedulerService }
): TrackerHubMachineStore {
	const { node, dispatch, now = Date.now } = options;
	return {
		record: (sample) => machines.record(sample),
		latestSamples() {
			const sample =
				dispatch?.telemetry?.sample() ??
				machineReport(localRunnerStatus(scheduler), runs.activeLocal(), now());
			const stored = machines.latestSamples();
			const spokes = stored.filter((value) => nodeOf(value) !== node);
			// The hub's resource reading is taken once a minute and kept with its recorded report.
			const own = stored.find((value) => nodeOf(value) === node);
			const resources = trackerMachineSample.safeParse(own).data?.resources;
			return [
				...spokes,
				{
					...(sample as object),
					...(resources && { resources }),
					node,
					host_work: machineService.localHostWork()
				}
			];
		}
	};
}

function nodeOf(value: unknown): string | undefined {
	return trackerMachineSample.safeParse(value).data?.node;
}

export function localRunnerStatus(scheduler?: TrackerDispatchSchedulerService) {
	return scheduler?.runnerStatus() ?? { enabled: false };
}

export function machineReport(
	runner: ReturnType<typeof localRunnerStatus>,
	active: ReturnType<TrackerRunReadRepository['activeLocal']>,
	at: number
) {
	return {
		at: new Date(at).toISOString(),
		runner: { ...runner, active: active.filter(({ state }) => state !== 'queued').length }
	};
}

export function trackerFleetMachineStore(): TrackerHubMachineStore {
	const samples = new Map<string, z.infer<typeof trackerMachineSample>>();
	return {
		record(sample) {
			const parsed = trackerMachineSample.safeParse(sample).data;
			if (!parsed) return;
			if (samples.size >= 100 && !samples.has(parsed.node)) return;
			samples.set(parsed.node, parsed);
		},
		latestSamples: () => [...samples.values()]
	};
}

export function trackerSpokeStatus(links: readonly TrackerSpokeLoopService[]) {
	const hub = links.find(({ kind }) => kind === 'hub');
	const peer = links.find(({ kind }) => kind === 'peer');
	return {
		...(hub ? { hub: hub.upstream(), ...hub.status() } : { disabled: true }),
		...(peer && { peer: peer.status() })
	};
}
