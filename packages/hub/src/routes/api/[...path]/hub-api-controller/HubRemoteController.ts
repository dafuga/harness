// @harness-uid u_vusx2wyapy
import type { SessionRecord } from '../../../../models/accounts-access/HubAuthStore.types';
import type { Route, Call } from './HubRemoteController.types';
import type { Actor } from 'collaboration';
import type { RemoteHostRegistration } from '../../../../../../remote/src/models/networking-security/RemoteRelay.types';
import { hubBody, hubHttp } from '../../../../utils/networking-security/hub-http/hubHttp';
import { hubFail } from '../../../../utils/development-tooling/hubJson';
import type { HubRemoteRuntime } from '../../../../utils/networking-security/hubRemote';
import { RemoteHostValidator } from '../../../../validators/networking-security/RemoteHostValidator';

const validator = new RemoteHostValidator();

/** `/api/remote/hosts[/{hostId}[/devices/{deviceId}]]`, read literally: nothing decoded or skipped. */
function routeOf(path: string): Route | null {
	const parts = path.split('/');
	if (parts.slice(0, 4).join('/') !== '/api/remote/hosts' || parts.includes('', 1)) return null;
	if (parts.length === 4) return { kind: 'hosts', ids: [] };
	if (parts.length === 5) return { kind: 'host', ids: [parts[4]] };
	if (parts.length === 6 && parts[5] === 'pairing') return { kind: 'pairing', ids: [parts[4]] };
	if (parts.length === 7 && parts[5] === 'devices')
		return { kind: 'device', ids: [parts[4], parts[6]] };
	return browserRouteOf(parts);
}

function browserRouteOf(parts: string[]): Route | null {
	if (parts.length === 7 && parts[5] === 'connect')
		return { kind: 'browser-socket', ids: [parts[4], parts[6]] };
	if (parts.length === 8 && parts[5] === 'pairing') {
		const action = parts[7];
		if (action === 'poll' || action === 'exchange')
			return { kind: `browser-${action}`, ids: [parts[4], parts[6]] };
	}
	return null;
}

async function register(call: Call): Promise<Response> {
	const { remote, owner, session } = call;
	const input = await validator.registration(await hubBody(call.request));
	if (input.accountLinked && session?.kind !== 'native')
		return hubHttp({ error: 'forbidden' }, 403);
	const holder = input.accountLinked ? session?.idHash : undefined;
	const { hostId, generation, registeredAt } = await remote.relay.register({
		owner,
		holder,
		...input
	});
	const registration: RemoteHostRegistration = {
		hostId,
		origin: remote.origin,
		generation,
		registeredAt
	};
	return hubHttp(registration, 201);
}

async function computers(call: Call): Promise<Response> {
	const accountOnly = new URL(call.request.url).searchParams.get('linked') === '1';
	return hubHttp({ computers: await call.remote.relay.computers(call.owner, accountOnly) });
}

async function pairingKey(call: Call): Promise<Response> {
	const hostId = validator.hostId(call.ids[0]);
	const key = await call.remote.relay.pairingKey({ owner: call.owner, hostId });
	return hubHttp({ ...key, origin: call.remote.origin });
}

async function requestPairing(call: Call): Promise<Response> {
	const hostId = validator.hostId(call.ids[0]);
	const body = validator.pairing(await hubBody(call.request));
	const holder = call.session?.idHash;
	return hubHttp(
		await call.remote.relay.requestPairing({ owner: call.owner, hostId, holder }, body),
		202
	);
}

async function summary(call: Call): Promise<Response> {
	const hostId = validator.hostId(call.ids[0]);
	return hubHttp(await call.remote.relay.summary({ owner: call.owner, hostId }));
}

async function unregister(call: Call): Promise<Response> {
	const hostId = validator.hostId(call.ids[0]);
	return hubHttp(await call.remote.relay.unregister({ owner: call.owner, hostId }));
}

async function revokeDevice(call: Call): Promise<Response> {
	const hostId = validator.hostId(call.ids[0]),
		deviceId = validator.deviceId(call.ids[1]);
	return hubHttp(await call.remote.relay.revokeDevice({ owner: call.owner, hostId, deviceId }));
}

function browserHolder(call: Call): string {
	const { session, request } = call;
	const origin = new URL(request.url).origin;
	if (session?.kind !== 'browser' || request.headers.get('Origin') !== origin)
		return hubFail('forbidden');
	return session.idHash;
}

async function browserPairing(call: Call, operation: 'poll' | 'exchange'): Promise<Response> {
	const holder = browserHolder(call);
	const hostId = validator.hostId(call.ids[0]);
	const pairingId = validator.pairingId(call.ids[1]);
	const body = await hubBody(call.request);
	const proof = operation === 'exchange' ? { verifier: body.verifier } : {};
	return call.remote.relay.browserPairing(
		{ owner: call.owner, hostId, holder },
		{ pairingId, operation, proof }
	);
}

async function browserSocket(call: Call): Promise<Response> {
	const holder = browserHolder(call);
	const hostId = validator.hostId(call.ids[0]);
	const deviceId = validator.deviceId(call.ids[1]);
	if (call.request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
		return hubHttp({ error: 'upgrade-required' }, 426);
	return call.remote.relay.browserSocket({ owner: call.owner, hostId, holder, deviceId });
}

const ACTIONS = new Map<string, (call: Call) => Promise<Response>>([
	['POST hosts', register],
	['GET hosts', computers],
	['GET host', summary],
	['GET pairing', pairingKey],
	['POST pairing', requestPairing],
	['POST browser-poll', (call) => browserPairing(call, 'poll')],
	['POST browser-exchange', (call) => browserPairing(call, 'exchange')],
	['GET browser-socket', browserSocket],
	['DELETE host', unregister],
	['DELETE device', revokeDevice]
]);

/**
 * Owner control of remote hosts. The hub only records who owns a host and forwards that to the
 * relay; it runs nothing. The caller is authenticated before this controller is reached.
 */
export class HubRemoteController {
	constructor(private readonly remote?: HubRemoteRuntime | null) {}

	async handle(request: Request, actor: Actor, session?: SessionRecord | null): Promise<Response> {
		const route = routeOf(new URL(request.url).pathname);
		if (!route) return hubHttp({ error: 'not-found' }, 404);
		const action = ACTIONS.get(`${request.method} ${route.kind}`);
		if (!action) return hubHttp({ error: 'method-denied' }, 405);
		const remote = this.remote ?? hubFail('remote-disabled');
		return action({ request, remote, owner: { id: actor.id }, session, ids: route.ids });
	}
}
