import type { HostRoute } from './PublicRelayController.types';
import { REMOTE_PROTOCOL } from '../../../../../remote/src/index';
import { relayConfig } from '../../../configs/networking-security/relayConfig';
import { ConnectGuardMiddleware } from './ConnectGuardMiddleware';
import type { PairingRoute, RelayEnv } from '../../../models/networking-security/RelayHost.types';
import { publicRoute } from '../../../utils/development-tooling/publicRoute';
import { readJsonBody } from '../../../utils/development-tooling/readJsonBody';
import { relayError, relayResponse } from '../../../utils/networking-security/relayResponse';

/**
 * The public Worker. It serves the routes of contract §5.1 and nothing else: a request that is
 * no such route, `/manage/*` under any verb included, is answered here and reaches no object.
 */
export class PublicRelayController {
	private readonly guard: ConnectGuardMiddleware;

	constructor(private readonly env: RelayEnv) {
		this.guard = new ConnectGuardMiddleware(env);
	}

	async handle(request: Request): Promise<Response> {
		const route = publicRoute(request.method, new URL(request.url).pathname);
		if (!route) return relayError(404, 'not-found');
		const refused = this.guard.transport(request);
		if (refused) return refused;
		if (route.kind === 'health') return relayResponse(200, { ok: true, protocol: REMOTE_PROTOCOL });
		if (route.kind === 'connect') return this.connect(request, route);
		return this.pairing(request, route);
	}

	/** The upgrade goes to the host object with its headers. The query string does not. */
	private async connect(request: Request, route: HostRoute): Promise<Response> {
		const refused = this.guard.handle(request);
		if (refused) return refused;
		return this.forward(route, { method: 'GET', headers: request.headers });
	}

	/** A body is read here, bounded, and sent on as the JSON object it was. */
	private async pairing(request: Request, route: PairingRoute): Promise<Response> {
		if (route.action === 'info') return this.forward(route, { method: 'GET' });
		const body = await readJsonBody(request);
		const failure = route.action === 'exchange' ? 'pairing-invalid' : 'invalid-input';
		if (!body) return relayError(400, failure);
		const headers = { 'Content-Type': 'application/json' };
		return this.forward(route, { method: 'POST', headers, body: JSON.stringify(body) });
	}

	/** The one place a request leaves the Worker: to the object of the host, under a route path. */
	private forward(route: HostRoute, init: RequestInit): Promise<Response> {
		const hosts = this.env.REMOTE_HOSTS;
		return hosts
			.get(hosts.idFromName(route.hostId))
			.fetch(relayConfig.internalOrigin + route.path, init);
	}
}
