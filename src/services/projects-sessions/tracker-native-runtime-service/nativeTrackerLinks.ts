// @harness-uid u_bl6xl2h4a3
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
	options: TrackerNativeRuntimeOptions
) {
	const telemetry = options.dispatch?.telemetry;
	const link = options.links?.find((entry) => (entry.link ?? 'hub') === 'hub');
	const machines = options.syncResponder?.machines;
	if (machines) return { tick: undefined, samples: () => machines.latestSamples() };
	if (!telemetry || !link) return { tick: undefined, samples: undefined };
	const now = options.now ?? Date.now;
	let nextPoll = -Infinity;
	let samples: readonly unknown[] = [];
	const tick = async (signal: AbortSignal) => {
		if (now() < nextPoll) return;
		nextPoll = now() + 60_000;
		const client = new TrackerSpokeSyncService({
			...link,
			store,
			transport: (request) => link.transport(request, signal)
		});
		const received = await client.exchangeMachine(telemetry.sample(), runs.exportLocal());
		signal.throwIfAborted();
		if (received.run_history) runs.importHubHistory(received.run_history);
		samples = received.machines;
		telemetry.onMachines?.(samples);
	};
	return { tick, samples: () => samples };
}

export function trackerSpokeStatus(links: readonly TrackerSpokeLoopService[]) {
	const hub = links.find(({ kind }) => kind === 'hub');
	const peer = links.find(({ kind }) => kind === 'peer');
	return {
		...(hub ? { hub: hub.upstream(), ...hub.status() } : { disabled: true }),
		...(peer && { peer: peer.status() })
	};
}
