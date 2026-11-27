// @harness-uid u_bl6xl2h4a3
import type { TrackerHostWork } from '../../../utils/projects-sessions/trackerHostWork.types';
import type { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import type { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerMachineService } from '../TrackerMachineService';
import type { TrackerFleetReport } from '../TrackerMachineService.types';
import { hubTelemetryTick } from './trackerFleetTelemetry';
import { spokeReport } from './trackerSpokeTelemetry';
import type { TrackerWireValue } from '../TrackerHubSyncService.types';
import type { TrackerTelemetryParts } from './nativeTrackerTelemetry.types';
import { TrackerSpokeSyncService } from '../TrackerSpokeSyncService';
import { localRunnerStatus, machineReport } from './nativeTrackerLinks';

export function composeTrackerTelemetry(
	store: TrackerPersistenceService,
	runs: TrackerRunReadRepository,
	options: TrackerNativeRuntimeOptions,
	parts: TrackerTelemetryParts
) {
	const { machines, fleet, scheduler } = parts;
	if (fleet)
		return {
			tick: hubTelemetryTick({ fleet, machines, runs, scheduler, options }),
			samples: () => fleet.latestSamples()
		};
	const { links = [] } = options;
	const hub = links.find((entry) => (entry.link ?? 'hub') === 'hub');
	if (!hub) return { tick: undefined, samples: undefined };
	let samples: readonly unknown[] = [];
	const exchanges = links.map((link) =>
		telemetryExchange({ store, runs, options, machines, scheduler, link }, (received) => {
			// Only the hub has the fleet view; a Mac peer answers with run history alone.
			if (link !== hub) return;
			samples = received;
			machines.ingest(received as readonly TrackerFleetReport[]);
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
		machines,
		scheduler,
		link
	}: {
		store: TrackerPersistenceService;
		runs: TrackerRunReadRepository;
		options: TrackerNativeRuntimeOptions;
		machines: TrackerMachineService;
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
		const hostWork = machines.localHostWork();
		const launchState = launchSampleRevision(runner, active, runs.latestLocalRunId(), hostWork);
		if (now() < nextPoll && launchState === previousLaunchState) return;
		nextPoll = now() + 60_000;
		const client = new TrackerSpokeSyncService({
			...link,
			store,
			transport: (request) => link.transport(request, signal)
		});
		const sample =
			options.dispatch?.telemetry?.sample() ??
			(await spokeReport(machines, machineReport(runner, active, now())));
		const report = { ...(sample as object), host_work: hostWork } as unknown as TrackerWireValue;
		const received = await client.exchangeMachine(report, runs.exportLocal());
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
	latestId: number | undefined,
	hostWork: TrackerHostWork[]
) {
	return JSON.stringify([
		runner.enabled,
		runner.last_error,
		runner.capacity,
		runner.automatic_enabled,
		runner.waiting,
		runner.waiting_tokens,
		latestId,
		active.map(({ id, state }) => [id, state]),
		hostWork.map(({ run, host }) => [run, host])
	]);
}
