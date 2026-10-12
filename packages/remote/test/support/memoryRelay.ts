import type { RemotePairingRequest } from '../../src/models/RemoteControl.types';
import type { RelayPairingRequest, RelayPairingState } from '../../src/models/RemoteRelay.types';
import type { HostPairingService } from '../../src/services/HostPairingService';
import { pkceChallenge, randomCredential } from '../../src/utils/remoteIdentity';

interface Entry {
	state: RelayPairingState;
	expiresAt: string;
	challenge?: string;
	approval?: { deviceId: string; sealed: string };
}
interface RelayInput {
	hostId: string;
	hostKey: string;
	host: HostPairingService;
}
interface RelayState {
	input: RelayInput;
	relay: { hostKey: string };
	pairings: Map<string, Entry>;
	calls: string[];
	bodies: string[];
	received: (RemotePairingRequest | null)[];
}
interface Route {
	path: string;
	method: string;
	body: string | null;
	hostId: string;
	pairingId: string;
	operation: string;
}
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
	const request = parsed(route.body) as unknown as RelayPairingRequest;
	entry.state = 'requested';
	entry.challenge = request.challenge;
	state.received.push(await state.input.host.receive({ pairingId: route.pairingId, ...request }));
	return json({ state: 'requested', expiresAt: entry.expiresAt }, 202);
}
async function serve(state: RelayState, route: Route) {
	state.calls.push(`${route.method} ${route.path}`);
	if (route.body !== null) state.bodies.push(route.body);
	const entry = route.hostId === state.input.hostId ? state.pairings.get(route.pairingId) : null;
	if (!entry) return json({ error: 'not-found' }, 404);
	if (route.method !== 'GET') return post(state, entry, route);
	const { hostId, pairingId } = route;
	return json({ hostId, pairingId, hostKey: state.relay.hostKey, ...entry, challenge: undefined });
}

/** The public pairing routes of a relay, in memory, forwarding requests to one host. */
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
		open: (offer: { pairingId: string; expiresAt: string }) =>
			state.pairings.set(offer.pairingId, { state: 'open', expiresAt: offer.expiresAt }),
		approve: (pairingId: string, approval: { deviceId: string; sealed: string }) =>
			Object.assign(state.pairings.get(pairingId)!, { state: 'approved', approval })
	};
}
