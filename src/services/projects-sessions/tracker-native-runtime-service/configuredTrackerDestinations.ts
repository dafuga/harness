// @harness-uid u_bl6xl2h4a3
import type { TrackerDestination } from '../TrackerNotificationService.types';
import type { TrackerLegacyDestinationBindings } from '../TrackerNativeRuntimeService.types';

/** Resolve a legacy descriptor only through the configured, node-local bindings. */
export function configuredTrackerDestinations(bindings: TrackerLegacyDestinationBindings) {
	return (descriptor: unknown): TrackerDestination | undefined => {
		if (!descriptor || typeof descriptor !== 'object') return undefined;
		const { url, cmd } = descriptor as { url?: unknown; cmd?: unknown };
		if (typeof url === 'string' && cmd === undefined)
			return binding('http', bindings.urls?.get(url));
		if (typeof cmd === 'string' && url === undefined)
			return binding('command', bindings.commands?.get(cmd));
		return undefined;
	};
}

function binding(
	kind: TrackerDestination['kind'],
	id: string | undefined
): TrackerDestination | undefined {
	return id ? { kind, id } : undefined;
}
