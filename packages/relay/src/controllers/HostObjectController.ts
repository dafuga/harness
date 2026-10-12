import type { HostScope } from '../models/RelayHost.types';
import type { SocketAcceptService } from '../services/SocketAcceptService';
import { publicRoute } from '../utils/publicRoute';
import { relayError } from '../utils/relayResponse';
import type { ManageController } from './ManageController';
import type { PairingController } from './PairingController';

const managePrefix = '/manage/';

/**
 * Every request a host object receives. Management arrives from a Worker that holds a binding
 * to the namespace; the public Worker sends only public routes, and only those of the host this
 * object is named after are served.
 */
export class HostObjectController {
	constructor(
		private readonly scope: HostScope,
		private readonly manage: ManageController,
		private readonly pairing: PairingController,
		private readonly sockets: SocketAcceptService
	) {}

	async handle(request: Request): Promise<Response> {
		const { pathname } = new URL(request.url);
		if (pathname.startsWith(managePrefix)) {
			return this.manage.handle(request, pathname.slice(managePrefix.length));
		}
		const route = publicRoute(request.method, pathname);
		if (!route || route.kind === 'health') return relayError(404, 'not-found');
		if (!this.scope.owns(route.hostId)) return relayError(404, 'not-found');
		if (route.kind === 'pairing') return this.pairing.handle(request, route);
		return this.sockets.accept(request);
	}
}
