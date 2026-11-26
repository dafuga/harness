// @harness-uid u_bl6xl2h4a3
import type { TrackerLaunchIntent } from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerNativeRuntimeOptions } from '../TrackerNativeRuntimeService.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import { TrackerSpokeSyncService } from '../TrackerSpokeSyncService';

export function spokeGrant(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions,
	mayStartAlone: (itemId: string) => boolean
) {
	const permit = hubPermit(store, options);
	if (!permit) return undefined;
	return async (itemId: string, token: string, signal: AbortSignal) => {
		// Only the due owner hears `unreachable`, so other items never take a local fleet slot.
		const decision = await permit(itemId, token, signal).then(
			(allowed) => (allowed ? ('granted' as const) : ('denied' as const)),
			(error: unknown) =>
				hubUnavailable(error) && mayStartAlone(itemId)
					? ('unreachable' as const)
					: ('denied' as const)
		);
		return { token, node: store.node, decision };
	};
}

/** While the hub is down, due work falls back to this node's own fleet slots. */
export function spokeAutomaticPermit(
	store: TrackerPersistenceService,
	options: TrackerNativeRuntimeOptions,
	localPermit: () => boolean
) {
	const permit = hubPermit(store, options);
	if (!permit) return undefined;
	return async (
		id: string,
		token: string,
		signal: AbortSignal,
		source: TrackerLaunchIntent['source']
	) =>
		permit(id, token, signal, 'automatic').catch(
			(error: unknown) => source === 'due' && hubUnavailable(error) && localPermit()
		);
}

function hubPermit(store: TrackerPersistenceService, options: TrackerNativeRuntimeOptions) {
	const hub = options.links?.find(({ link }) => (link ?? 'hub') === 'hub');
	if (!hub) return undefined;
	return async (id: string, token: string, signal: AbortSignal, scope?: 'automatic') => {
		const lifetime = AbortSignal.any([signal, AbortSignal.timeout(2000)]);
		const client = new TrackerSpokeSyncService({
			...hub,
			store,
			transport: (request) => hub.transport(request, lifetime)
		});
		return client.permitDue(id, token, scope);
	};
}

/** Gateway statuses, including Cloudflare's, that mean the request did not get an answer from the hub. */
const gatewayStatuses = new Set<unknown>([502, 503, 504, 521, 522, 523, 524, 530]);

const connectionFailures = new Set<unknown>([
	'ECONNREFUSED',
	'ECONNRESET',
	'EPIPE',
	'ETIMEDOUT',
	'ENETUNREACH',
	'EHOSTUNREACH',
	'UND_ERR_SOCKET',
	'UND_ERR_CONNECT_TIMEOUT',
	// A failed DNS lookup, as Node names it.
	'ENOTFOUND',
	'EAI_AGAIN',
	// Bun 1.2, which the shipped binary runs on: refused or unresolved, and no usable network.
	'ConnectionRefused',
	'FailedToOpenSocket'
]);

/** True only for an outage. A refusal or a bad reply from a reachable hub is not one. */
function hubUnavailable(error: unknown): boolean {
	if (!(error instanceof Error || error instanceof DOMException)) return false;
	const { name, status, code, cause } = error as Error & {
		status?: number;
		code?: unknown;
		cause?: { code?: unknown };
	};
	// Bun puts the socket code on the error; Node's fetch puts it on the cause.
	return (
		name === 'TimeoutError' ||
		gatewayStatuses.has(status) ||
		connectionFailures.has(cause?.code ?? code)
	);
}
