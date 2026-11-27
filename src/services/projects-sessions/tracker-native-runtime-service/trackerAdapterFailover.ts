// @harness-uid u_bl6xl2h4a3
import type {
	TrackerDispatchItem,
	TrackerLaunchIntent
} from '../../agents-providers/TrackerDispatcherService.types';
import type { z } from 'zod';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import { trackerMachineSample, type trackerRunnerSample } from './nativeTrackerLinks';

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
