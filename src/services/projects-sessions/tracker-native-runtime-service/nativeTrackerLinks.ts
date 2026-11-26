// @harness-uid u_bl6xl2h4a3
import { z } from 'zod';
import type { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type { TrackerHubMachineStore } from '../TrackerHubSyncService.types';
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerSpokeLoopService } from '../TrackerSpokeLoopService';
import { observeTrackerDuePolicy } from './nativeTrackerDuePolicy';

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
	scheduler?: TrackerDispatchSchedulerService
): TrackerHubMachineStore {
	const { node, dispatch, now = Date.now } = options;
	return {
		record: (sample) => machines.record(sample),
		latestSamples() {
			const sample =
				dispatch?.telemetry?.sample() ??
				machineReport(localRunnerStatus(scheduler), runs.activeLocal(), now());
			const spokes = machines
				.latestSamples()
				.filter((value) => trackerMachineSample.safeParse(value).data?.node !== node);
			return [...spokes, Object.assign({}, sample, { node })];
		}
	};
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

export const trackerRunnerSample = z.object({
	enabled: z.boolean().nullish(),
	last_tick_at: z.string().nullish(),
	last_error: z.string().nullish(),
	waiting_on: z.string().nullish(),
	active: z.int().nonnegative().nullish(),
	automatic_enabled: z.boolean().optional(),
	capacity: z
		.object({
			freeSlots: z.int().min(0).max(500),
			projects: z.record(
				z.string(),
				z.object({ freeGB: z.number().nonnegative(), freePct: z.number().min(0).max(100) })
			)
		})
		.nullish(),
	waiting: z.record(z.string(), z.string()).optional(),
	waiting_tokens: z.record(z.string(), z.string()).optional()
});

export const trackerMachineSample = z.object({
	node: z.string().min(1).max(128),
	at: z.iso.datetime(),
	runner: trackerRunnerSample
});

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
