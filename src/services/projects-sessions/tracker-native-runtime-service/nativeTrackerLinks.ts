// @harness-uid u_bl6xl2h4a3
import { z } from 'zod';
import type { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type { TrackerHubMachineStore } from '../TrackerHubSyncService.types';
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerSpokeLoopService } from '../TrackerSpokeLoopService';
import { TrackerSpokeSyncService } from '../TrackerSpokeSyncService';
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

export function composeTrackerTelemetry(
	store: TrackerPersistenceService,
	runs: TrackerRunReadRepository,
	options: TrackerNativeRuntimeOptions,
	scheduler?: TrackerDispatchSchedulerService
) {
	const telemetry = options.dispatch?.telemetry;
	const link = options.links?.find((entry) => (entry.link ?? 'hub') === 'hub');
	const machines = options.syncResponder?.machines;
	if (machines) return { tick: undefined, samples: () => machines.latestSamples() };
	if (!link) return { tick: undefined, samples: undefined };
	const now = options.now ?? Date.now;
	let nextPoll = -Infinity;
	let previousLaunchState = '';
	let samples: readonly unknown[] = [];
	const tick = async (signal: AbortSignal) => {
		const active = runs.activeLocal();
		const runner = scheduler?.runnerStatus() ?? { enabled: false };
		const launchState = launchSampleRevision(runner, active, runs.latestLocalRunId());
		if (now() < nextPoll && launchState === previousLaunchState) return;
		nextPoll = now() + 60_000;
		const client = new TrackerSpokeSyncService({
			...link,
			store,
			transport: (request) => link.transport(request, signal)
		});
		const sample = telemetry?.sample() ?? {
			at: new Date(now()).toISOString(),
			runner: {
				...runner,
				active: active.filter(({ state }) => state !== 'queued').length
			}
		};
		const received = await client.exchangeMachine(sample, runs.exportLocal());
		signal.throwIfAborted();
		if (received.run_history) runs.importHubHistory(received.run_history);
		previousLaunchState = launchState;
		samples = received.machines;
		telemetry?.onMachines?.(samples);
	};
	return { tick, samples: () => samples };
}

function launchSampleRevision(
	runner: {
		enabled: boolean;
		last_error?: string | null;
		waiting?: unknown;
		waiting_tokens?: unknown;
	},
	active: ReturnType<TrackerRunReadRepository['activeLocal']>,
	latestId: number | undefined
) {
	return JSON.stringify([
		runner.enabled,
		runner.last_error,
		runner.waiting,
		runner.waiting_tokens,
		latestId,
		active.map(({ id, state }) => [id, state])
	]);
}

export const trackerRunnerSample = z.object({
	enabled: z.boolean().nullish(),
	last_tick_at: z.string().nullish(),
	last_error: z.string().nullish(),
	waiting_on: z.string().nullish(),
	active: z.int().nonnegative().nullish(),
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
