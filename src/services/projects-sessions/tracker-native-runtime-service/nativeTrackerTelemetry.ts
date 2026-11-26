// @harness-uid u_bl6xl2h4a3
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerSpokeSyncService } from '../TrackerSpokeSyncService';
import { localRunnerStatus, machineReport } from './nativeTrackerLinks';

export function composeTrackerTelemetry(
	store: TrackerPersistenceService,
	runs: TrackerRunReadRepository,
	options: TrackerNativeRuntimeOptions,
	scheduler?: TrackerDispatchSchedulerService
) {
	const machines = options.syncResponder?.machines;
	if (machines) return { tick: undefined, samples: () => machines.latestSamples() };
	const { links = [] } = options;
	const hub = links.find((entry) => (entry.link ?? 'hub') === 'hub');
	if (!hub) return { tick: undefined, samples: undefined };
	let samples: readonly unknown[] = [];
	const exchanges = links.map((link) =>
		telemetryExchange({ store, runs, options, scheduler, link }, (received) => {
			// Only the hub has the fleet view; a Mac peer answers with run history alone.
			if (link !== hub) return;
			samples = received;
			options.dispatch?.telemetry?.onMachines?.(samples);
		})
	);
	// Links report independently, so a hub that is slow or down cannot hold back the Mac peer.
	const tick = async (signal: AbortSignal) => {
		const results = await Promise.allSettled(exchanges.map((exchange) => exchange(signal)));
		const failed = results.find((result) => result.status === 'rejected');
		if (failed) throw failed.reason;
	};
	return { tick, samples: () => samples };
}

function telemetryExchange(
	{
		store,
		runs,
		options,
		scheduler,
		link
	}: {
		store: TrackerPersistenceService;
		runs: TrackerRunReadRepository;
		options: TrackerNativeRuntimeOptions;
		scheduler?: TrackerDispatchSchedulerService;
		link: NonNullable<TrackerNativeRuntimeOptions['links']>[number];
	},
	onMachines: (machines: readonly unknown[]) => void
) {
	const now = options.now ?? Date.now;
	let nextPoll = -Infinity;
	let previousLaunchState = '';
	return async (signal: AbortSignal) => {
		const active = runs.activeLocal();
		const runner = localRunnerStatus(scheduler);
		const launchState = launchSampleRevision(runner, active, runs.latestLocalRunId());
		if (now() < nextPoll && launchState === previousLaunchState) return;
		nextPoll = now() + 60_000;
		const client = new TrackerSpokeSyncService({
			...link,
			store,
			transport: (request) => link.transport(request, signal)
		});
		const sample = options.dispatch?.telemetry?.sample() ?? machineReport(runner, active, now());
		const received = await client.exchangeMachine(sample, runs.exportLocal());
		signal.throwIfAborted();
		if (received.run_history) runs.importLinkHistory(received.run_history);
		previousLaunchState = launchState;
		onMachines(received.machines);
	};
}

function launchSampleRevision(
	runner: {
		enabled: boolean;
		last_error?: string | null;
		capacity?: unknown;
		automatic_enabled?: boolean;
		waiting?: unknown;
		waiting_tokens?: unknown;
	},
	active: ReturnType<TrackerRunReadRepository['activeLocal']>,
	latestId: number | undefined
) {
	return JSON.stringify([
		runner.enabled,
		runner.last_error,
		runner.capacity,
		runner.automatic_enabled,
		runner.waiting,
		runner.waiting_tokens,
		latestId,
		active.map(({ id, state }) => [id, state])
	]);
}
