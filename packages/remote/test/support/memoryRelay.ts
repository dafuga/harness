import type { Route, RelayState, Entry, RelayInput } from './memoryRelay.types';
import type { RelayPairingRequest } from '../../src/models/networking-security/RemoteRelay.types';
import { pkceChallenge, randomCredential } from '../../src/utils/remoteIdentity';
const json = (value: unknown, status = 200) =>
	new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const parsed = (body: string | null) => JSON.parse(body ?? '{}') as Record<string, unknown>;

function routeOf(target: RequestInfo | URL, init?: RequestInit): Route {
	const url = new URL(String(target)),
		parts = url.pathname.split('/').filter(Boolean);
	return {
		path: url.pathname,
		method: init?.method ?? 'GET',
		body: typeof init?.body === 'string' ? init.body : null,
		hostId: parts[2] ?? '',
		pairingId: parts[4] ?? '',
		operation: parts[5] ?? ''
	};
}
async function exchange(state: RelayState, entry: Entry, route: Route) {
	state.pairings.delete(route.pairingId);
	const proven = entry.challenge === (await pkceChallenge(String(parsed(route.body).verifier)));
	return entry.state === 'approved' && entry.approval && proven
		? json({ ...entry.approval, credential: randomCredential() })
		: json({ error: 'pairing-invalid' }, 400);
}
async function post(state: RelayState, entry: Entry, route: Route) {
	if (route.operation === 'poll') return json({ state: entry.state, expiresAt: entry.expiresAt });
	if (route.operation === 'exchange') return exchange(state, entry, route);
	return json({ error: 'not-found' }, 404);
}
async function serve(state: RelayState, route: Route) {
	state.calls.push(`${route.method} ${route.path}`);
	if (route.body !== null) state.bodies.push(route.body);
	const entry = route.hostId === state.input.hostId ? state.pairings.get(route.pairingId) : null;
	if (!entry) return json({ error: 'not-found' }, 404);
	return post(state, entry, route);
}

/**
 * The pairing routes of a relay, in memory. A request arrives as a verified account request
 * (`submit`); poll and exchange are the public routes. It forwards requests to one host.
 */
export function memoryRelay(input: RelayInput) {
	const state: RelayState = {
		input,
		relay: { hostKey: input.hostKey },
		pairings: new Map(),
		calls: [],
		bodies: [],
		received: []
	};
	const fetcher = (target: RequestInfo | URL, init?: RequestInit) =>
		serve(state, routeOf(target, init));
	return {
		fetch: fetcher as typeof fetch,
		relay: state.relay,
		calls: state.calls,
		bodies: state.bodies,
		received: state.received,
		/** A verified account request, as the relay hands it to the host. */
		submit: async (pairingId: string, request: RelayPairingRequest) => {
			const expiresAt = new Date(Date.now() + 300000).toISOString();
			state.pairings.set(pairingId, {
				state: 'requested',
				expiresAt,
				challenge: request.challenge
			});
			state.received.push(
				await input.host.receive({ pairingId, account: true, expiresAt, ...request })
			);
		},
		approve: (pairingId: string, approval: { deviceId: string; sealed: string }) =>
			Object.assign(state.pairings.get(pairingId)!, { state: 'approved', approval }),
		deny: (pairingId: string) => Object.assign(state.pairings.get(pairingId)!, { state: 'denied' }),
		/** The host withdrew the request: the relay no longer knows it. */
		close: (pairingId: string) => state.pairings.delete(pairingId)
	};
}
