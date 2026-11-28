// @harness-uid u_bl6xl2h4a3
import { isTrackerAwaitingAnswer } from '../../../utils/projects-sessions/isTrackerAwaitingAnswer';
import { z } from 'zod';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { canonicalNode } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import { trackerRunnerSample } from './nativeTrackerLinks';
import { trackerDueItemPreview } from './readTrackerDuePreview';

const machineSample = z.object({ node: z.string().min(1), at: z.string(), runner: z.unknown() });

/** Both the show route and the supervisor status describe a waiting request from here. */
export function trackerItemViews(runtime: TrackerNativeRuntimeService) {
	return {
		schedulePreview: (item: TrackerItem) => trackerDueItemPreview(runtime, item),
		launchWait: runtime.scheduler && ((item: TrackerItem) => trackerLaunchWait(runtime, item))
	};
}

/** Why a requested launch has not started, from stored state and each launcher's latest report. */
export function trackerLaunchWait(runtime: TrackerNativeRuntimeService, item: TrackerItem) {
	const node = canonicalNode(runtime.store.node, {});
	const target = item.launch_target ?? item.computer;
	const computer = target && target !== 'auto' ? canonicalNode(target, {}) : node;
	const reason =
		itemWait(item) ??
		(computer === node ? localWait(runtime, item) : peerWait(runtime, item, computer));
	return { computer, reason };
}

/** Every request without a started run, split into launchable and held ones. */
export function trackerRequestWaits(runtime: TrackerNativeRuntimeService) {
	const items = new TrackerItemReadRepository(runtime.store.database, runtime.now);
	const requests = (runtime.scheduler?.status(0).stuck ?? []).map(({ id, title }) => ({
		id,
		title,
		...trackerLaunchWait(runtime, items.getStored(id))
	}));
	return {
		ready: requests.filter(({ reason }) => reason === 'ready'),
		skipped: requests.filter(({ reason }) => reason !== 'ready')
	};
}

/** The latest valid machine report from each computer. */
export function trackerMachineSamples(runtime: TrackerNativeRuntimeService) {
	const samples = new Map<string, z.infer<typeof machineSample>>();
	for (const value of runtime.fleetSamples?.() ?? []) {
		const sample = machineSample.safeParse(value).data;
		if (sample && Number.isFinite(Date.parse(sample.at))) samples.set(sample.node, sample);
	}
	return samples;
}

export function machineOffline(sampledAt: string | undefined, now: number) {
	return !sampledAt || now - Date.parse(sampledAt) > 300_000;
}

function itemWait(item: TrackerItem): string | undefined {
	if (item.deleted) return 'item is deleted';
	if (item.status === 'done' || item.status === 'ignored') return `item is ${item.status}`;
	if (item.status === 'blocked') return item.blocked_reason ?? 'item is blocked';
	return isTrackerAwaitingAnswer(item) ? 'waiting on Daniel' : undefined;
}

function localWait({ scheduler }: TrackerNativeRuntimeService, item: TrackerItem) {
	const runner = scheduler?.runnerStatus(Number.MAX_SAFE_INTEGER);
	if (!runner?.enabled) return 'launcher disabled on this computer';
	return reportedWait(runner, item) ?? 'ready';
}

function peerWait(runtime: TrackerNativeRuntimeService, item: TrackerItem, computer: string) {
	if (!runtime.fleetSamples) return `queued on ${computer}`;
	const sample = trackerMachineSamples(runtime).get(computer);
	if (machineOffline(sample?.at, runtime.now())) return `waiting for ${computer} to sync`;
	const runner = trackerRunnerSample.safeParse(sample?.runner).data;
	if (runner?.enabled === false) return `launcher disabled on ${computer}`;
	return (runner && reportedWait(runner, item)) ?? `queued on ${computer}`;
}

/** A hold reported for an earlier request of this item says nothing about the current one. */
function reportedWait(
	{ waiting, waiting_tokens }: z.infer<typeof trackerRunnerSample>,
	{ id, auto }: TrackerItem
) {
	const token = waiting_tokens?.[id];
	return token === undefined || token === auto ? waiting?.[id] : undefined;
}
