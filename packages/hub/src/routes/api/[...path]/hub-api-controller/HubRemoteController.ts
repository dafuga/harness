import type { Actor } from 'collaboration';
import type { RemoteHostRegistration } from '../../../../../../remote/src/models/RemoteRelay.types';
import { hubBody, hubHttp } from '../../../../utils/networking-security/hub-http/hubHttp';
import { hubFail } from '../../../../utils/development-tooling/hubJson';
import type { HubRemoteRuntime } from '../../../../utils/networking-security/hubRemote';
import { RemoteHostValidator } from '../../../../validators/networking-security/RemoteHostValidator';

interface Route {
	kind: 'hosts' | 'host' | 'device';
	ids: string[];
}

interface Call {
	request: Request;
	remote: HubRemoteRuntime;
	/** Always the verified session actor. Nothing a request carries names the owner. */
	owner: { id: string };
	ids: string[];
}

const validator = new RemoteHostValidator();

/** `/api/remote/hosts[/{hostId}[/devices/{deviceId}]]`, read literally: nothing decoded or skipped. */
function routeOf(path: string): Route | null {
	const parts = path.split('/');
	if (parts.slice(0, 4).join('/') !== '/api/remote/hosts' || parts.includes('', 1)) return null;
	if (parts.length === 4) return { kind: 'hosts', ids: [] };
	if (parts.length === 5) return { kind: 'host', ids: [parts[4]] };
	const device = parts.length === 7 && parts[5] === 'devices';
	return device ? { kind: 'device', ids: [parts[4], parts[6]] } : null;
}

async function register(call: Call): Promise<Response> {
	const { remote, owner } = call;
	const input = await validator.registration(await hubBody(call.request));
	const { hostId, generation, registeredAt } = await remote.relay.register({ owner, ...input });
	const registration: RemoteHostRegistration = {
		hostId,
		origin: remote.origin,
		generation,
		registeredAt
	};
	return hubHttp(registration, 201);
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

const ACTIONS = new Map<string, (call: Call) => Promise<Response>>([
	['POST hosts', register],
	['GET host', summary],
	['DELETE host', unregister],
	['DELETE device', revokeDevice]
]);

/**
 * Owner control of remote hosts. The hub only records who owns a host and forwards that to the
 * relay; it runs nothing. The caller is authenticated before this controller is reached.
 */
export class HubRemoteController {
	constructor(private readonly remote?: HubRemoteRuntime | null) {}

	async handle(request: Request, actor: Actor): Promise<Response> {
		const route = routeOf(new URL(request.url).pathname);
		if (!route) return hubHttp({ error: 'not-found' }, 404);
		const action = ACTIONS.get(`${request.method} ${route.kind}`);
		if (!action) return hubHttp({ error: 'method-denied' }, 405);
		const remote = this.remote ?? hubFail('remote-disabled');
		return action({ request, remote, owner: { id: actor.id }, ids: route.ids });
	}
}
