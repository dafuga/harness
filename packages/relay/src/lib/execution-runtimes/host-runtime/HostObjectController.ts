// @harness-uid u_whxs5oonrj
import type { HostScope } from '../../../models/networking-security/RelayHost.types';
import type { SocketAcceptService } from './SocketAcceptService';
import { publicRoute } from '../../../utils/development-tooling/publicRoute';
import { relayError } from '../../../utils/networking-security/relayResponse';
import type { ManageController } from './ManageController';
import type { PairingController } from './PairingController';
import { remotePatterns } from '../../../../../remote/src/index';
import { accountHolder } from '../../../validators/development-tooling/ManageBodyValidator';

const managePrefix = '/manage/';
const accountPrefix = '/account';

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
		if (pathname.startsWith(accountPrefix + '/'))
			return this.account(request, pathname.slice(accountPrefix.length));
		const route = publicRoute(request.method, pathname);
		if (!route || route.kind === 'health') return relayError(404, 'not-found');
		if (!this.scope.owns(route.hostId)) return relayError(404, 'not-found');
		if (route.kind === 'pairing') return this.pairing.handle(request, route);
		return this.sockets.accept(request, (host) => this.manage.index(host));
	}
	private account(request: Request, path: string): Promise<Response> | Response {
		const route = publicRoute(request.method, path);
		if (!route || route.kind === 'health' || !this.scope.owns(route.hostId))
			return relayError(404, 'not-found');
		const holder = accountHolder(request.headers.get('X-Harness-Account-Session'));
		const owner = request.headers.get('X-Harness-Account-Owner');
		if (!holder || !owner || !this.manage.ownsAccount(route.hostId, owner))
			return relayError(403, 'forbidden');
		if (route.kind === 'pairing') {
			if (!['poll', 'exchange'].includes(route.action)) return relayError(404, 'not-found');
			return this.pairing.handle(request, route, holder);
		}
		const deviceId = request.headers.get('X-Harness-Account-Device');
		if (!deviceId || !remotePatterns.deviceId.test(deviceId))
			return relayError(400, 'invalid-input');
		return this.sockets.account(request, holder, deviceId);
	}
}
