import type { TrackerFleetReport } from '../TrackerMachineService.types';
import type { SpokeLink, Active, SpokeTelemetry } from './trackerSpokeTelemetry.types';
// @harness-uid u_ac655bcttp
import type { TrackerDispatchSchedulerService } from '../TrackerDispatchSchedulerService';
import type { TrackerWireValue } from '../TrackerHubSyncService.types';
import type { TrackerMachineService } from '../TrackerMachineService';
import { TrackerSpokeSyncService } from '../TrackerSpokeSyncService';

/** A spoke reports to the hub each minute, and at once when its launcher state changes. */
export function spokeTelemetry(context: SpokeTelemetry) {
	const { options } = context;
	const link = options.links?.find((entry) => (entry.link ?? 'hub') === 'hub');
	if (!link) return { tick: undefined, samples: undefined };
	const now = options.now ?? Date.now;
	const override = options.dispatch?.telemetry;
	let nextPoll = -Infinity;
	let previousLaunchState = '';
	let samples: readonly unknown[] = [];
	const tick = async (signal: AbortSignal) => {
		const { machines, runs, scheduler } = context;
		const active = runs.activeLocal();
		const runner = runnerStatus(scheduler);
		const launchState = launchSampleRevision(runner, active, runs.latestLocalRunId());
		if (now() < nextPoll && launchState === previousLaunchState) return;
		nextPoll = now() + 60_000;
		const sample =
			override?.sample() ?? (await spokeSample(machines, { runner, active, at: now() }));
		const received = await exchange({ link, machines, signal }, sample, runs.exportLocal());
		if (received.run_history) runs.importHubHistory(received.run_history);
		previousLaunchState = launchState;
		samples = received.machines;
		machines.ingest(samples as readonly TrackerFleetReport[]);
		override?.onMachines?.(samples);
	};
	return { tick, samples: () => samples };
}

function runnerStatus(scheduler?: TrackerDispatchSchedulerService) {
	return scheduler?.runnerStatus() ?? { enabled: false };
}

async function exchange(
	{
		link,
		machines,
		signal
	}: { link: SpokeLink; machines: TrackerMachineService; signal: AbortSignal },
	sample: TrackerWireValue,
	runs: readonly TrackerWireValue[]
) {
	const client = new TrackerSpokeSyncService({
		...link,
		store: machines.store,
		transport: (request) => link.transport(request, signal)
	});
	const received = await client.exchangeMachine(sample, runs);
	signal.throwIfAborted();
	return received;
}

async function spokeSample(
	machines: TrackerMachineService,
	{ runner, active, at }: { runner: object; active: Active; at: number }
): Promise<TrackerWireValue> {
	// A failed reading must not stop the launcher report or the run history.
	const resources = await machines.sampleLocal().catch(() => undefined);
	return {
		at: new Date(at).toISOString(),
		runner: { ...runner, active: active.filter(({ state }) => state !== 'queued').length },
		...(resources && { resources })
	} as unknown as TrackerWireValue;
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
	active: Active,
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
