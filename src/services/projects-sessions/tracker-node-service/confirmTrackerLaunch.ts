// @harness-uid u_gvqtr5mdwv
import { setTimeout as delay } from 'node:timers/promises';
import { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type { TrackerItem } from '../../../repositories/projects-sessions/TrackerItemReadRepository.types';
import { TrackerRunReadRepository } from '../../../repositories/projects-sessions/TrackerRunReadRepository';
import { canonicalNode } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerNativeRuntimeService } from '../TrackerNativeRuntimeService';
import { trackerMachineSample } from '../tracker-native-runtime-service/nativeTrackerLinks';

const confirmationMs = 20_000;

export function trackerLaunchAwareItemResponse(
	request: Request,
	runtime: TrackerNativeRuntimeService
) {
	const response = runtime.items.handle(request);
	const { pathname, searchParams } = new URL(request.url);
	return request.method === 'POST' &&
		/^\/items\/[^/]+\/launch$/.test(pathname) &&
		searchParams.get('outcome') === 'run'
		? confirmTrackerLaunch(response, runtime, request.signal)
		: response;
}

/** Confirm the persisted intent without executing a second launch or cancelling a held request. */
async function confirmTrackerLaunch(
	write: Promise<Response>,
	runtime: TrackerNativeRuntimeService,
	signal: AbortSignal
): Promise<Response> {
	const response = await write;
	if (!response.ok) return response;
	const request = (await response.json()) as TrackerItem;
	if (!request.auto)
		return Response.json({ error: 'launch request was not recorded' }, { status: 409 });
	const { store } = runtime;
	const items = new TrackerItemReadRepository(store.database);
	const runs = new TrackerRunReadRepository(store.database, store.node);
	const node = launchNode(runtime, request);
	const deadline = performance.now() + confirmationMs;
	while (performance.now() < deadline) {
		const item = items.getStored(request.id);
		const run = runs
			.list({ itemId: item.id })
			.filter((candidate) => candidate.auto_token === request.auto && candidate.node === node)
			.at(-1);
		if (run) return launchRunResponse(item, run);
		if (item.deleted || item.auto !== request.auto)
			return Response.json({ error: 'launch request was withdrawn or replaced' }, { status: 409 });
		const hold = itemHold(item) ?? launchHold(runtime, item, node);
		if (hold) return pendingResponse(hold, node, 409);
		await delay(250, undefined, { signal });
	}
	return pendingResponse('no run confirmation within 20 seconds', node, 504);
}

function launchNode(runtime: TrackerNativeRuntimeService, item: TrackerItem) {
	const target = item.launch_target ?? item.computer;
	return target && target !== 'auto' ? canonicalNode(target, {}) : runtime.store.node;
}

function launchRunResponse(
	item: TrackerItem,
	run: ReturnType<TrackerRunReadRepository['list']>[number]
) {
	if (run.state !== 'finished' || run.outcome === 'done') return Response.json({ ...item, run });
	const reason = run.failure_reason ?? run.outcome ?? 'run finished before confirmation';
	return Response.json({ error: `run #${run.id} on ${run.node}: ${reason}`, run }, { status: 409 });
}

function itemHold(item: TrackerItem) {
	if (item.kind !== 'task') return `item is a ${item.kind}; only tasks can launch`;
	if (item.every) return 'recurring item';
	if (item.needs_daniel && !item.resolved) return 'waiting on Daniel (flagged)';
	if (item.status !== 'open' && item.status !== 'in_progress') return `item is ${item.status}`;
	return null;
}

function launchHold(runtime: TrackerNativeRuntimeService, item: TrackerItem, node: string) {
	if (node === runtime.store.node)
		return runtime.scheduler
			? runnerHold(runtime.scheduler.runnerStatus(Infinity), item)
			: 'launcher disabled';
	return runnerHold(remoteRunner(runtime, node), item);
}

function runnerHold(runner: ReturnType<typeof remoteRunner>, item: TrackerItem) {
	if (runner?.enabled === false) return 'launcher disabled';
	if (runner?.waiting_tokens?.[item.id] === item.auto) return runner?.waiting?.[item.id];
	return runner?.last_error;
}

function remoteRunner(runtime: TrackerNativeRuntimeService, node: string) {
	for (const value of runtime.fleetSamples?.() ?? []) {
		const sample = trackerMachineSample.safeParse(value).data;
		if (sample?.node === node && runtime.now() - Date.parse(sample.at) <= 120_000)
			return sample.runner;
	}
	return undefined;
}

function pendingResponse(reason: string, node: string, status: number) {
	return Response.json(
		{ error: `${reason} on ${node}. Launch request remains pending.`, computer: node },
		{ status }
	);
}
