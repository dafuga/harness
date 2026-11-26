// @harness-uid u_bl6xl2h4a3
import type {
	TrackerDispatchItem,
	TrackerLaunchIntent
} from '../../agents-providers/TrackerDispatcherService.types';
import { z } from 'zod';
import type { TrackerHubMachineStore } from '../TrackerHubSyncService.types';
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

export function adapterFailover(options: TrackerNativeRuntimeOptions, now: () => number) {
	const machines = options.syncResponder?.machines;
	const thresholds = options.hostEffects?.adapter?.dueDisk;
	return (item: TrackerDispatchItem, intent: TrackerLaunchIntent) => {
		if (!machines || !delegatableAdapterItem(item, intent)) return undefined;
		const project = (item.project ?? item.agent)?.toLowerCase();
		if (!project) return undefined;

		return machines
			.latestSamples()
			.map((sample) => trackerMachineSample.safeParse(sample).data)
			.find(
				(host) =>
					host &&
					currentAdapterHost(host, options.node, now()) &&
					adapterDiskFits(host.runner.capacity, project, thresholds)
			)?.node;
	};
}

function currentAdapterHost(
	host: NonNullable<ReturnType<typeof trackerMachineSample.safeParse>['data']>,
	local: string,
	now: number
) {
	const runner = host.runner;
	return (
		host.node !== local &&
		runner.automatic_enabled === true &&
		runner.enabled &&
		!runner.last_error &&
		runner.last_tick_at &&
		Math.abs(now - Date.parse(runner.last_tick_at)) <= 120_000 &&
		Math.abs(now - Date.parse(host.at)) <= 120_000
	);
}

function adapterDiskFits(
	capacity: z.infer<typeof trackerRunnerSample>['capacity'],
	project: string,
	thresholds?: { freeGB: number; freePct: number }
) {
	if (!capacity?.freeSlots) return false;
	const disk = capacity.projects[project];
	return Boolean(
		disk &&
		(!thresholds || (disk.freeGB >= thresholds.freeGB && disk.freePct >= thresholds.freePct))
	);
}

function delegatableAdapterItem(item: TrackerDispatchItem, intent: TrackerLaunchIntent) {
	// The verified cross-host tester lane uses Codex. Keep MB2's Claude placement held.
	return (
		item.adapterDueOwner &&
		!item.sensitive &&
		intent.source === 'due' &&
		intent.scheduledPick?.rung.cli === 'codex'
	);
}
