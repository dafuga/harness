import { remoteIdentity } from '../../../../remote/src/index';
import type { RelayManageDevice, RelayManageOwner } from '../../../../remote/src/index';
import type { HostStorageAdapter } from './HostStorageAdapter';
import type { HostRecord, HostScope } from '../../models/RelayHost.types';
import type { DeviceRevocationService } from './DeviceRevocationService';
import type { HostRegistryService } from './HostRegistryService';
import { readJsonBody } from '../../utils/readJsonBody';
import { relayError, relayResponse } from '../../utils/relayResponse';
import { ManageBodyValidator } from '../../validators/ManageBodyValidator';

const operations = ['register', 'summary', 'revoke-device', 'unregister'];

/**
 * `POST /manage/<operation>` of a host object. The caller is a Worker with a binding to the
 * namespace (the hub); it has authenticated the owner it names in the body.
 */
export class ManageController {
	private readonly validator = new ManageBodyValidator();

	constructor(
		private readonly scope: HostScope,
		private readonly store: HostStorageAdapter,
		private readonly registry: HostRegistryService,
		private readonly revocation: DeviceRevocationService
	) {}

	async handle(request: Request, operation: string): Promise<Response> {
		if (request.method !== 'POST' || !operations.includes(operation)) {
			return relayError(404, 'not-found');
		}
		const body = await readJsonBody(request, false);
		if (operation === 'register') return this.register(body);
		const call =
			operation === 'revoke-device' ? this.validator.device(body) : this.validator.owner(body);
		if (!call) return relayError(400, 'invalid-input');
		const host = this.store.host();
		if (!host || host.hostId !== call.hostId) return relayError(404, 'not-found');
		if (host.ownerId !== call.owner.id) return relayError(403, 'forbidden');
		return this.run(operation, call, host);
	}

	/** A host id is the hash of its key, and an object registers only the host it is named after. */
	private async register(body: unknown): Promise<Response> {
		const input = this.validator.register(body);
		if (!input || !this.scope.owns(input.hostId)) return relayError(400, 'invalid-input');
		if (!(await certifies(input.hostKey, input.hostId))) return relayError(400, 'invalid-input');
		const registered = this.registry.register(input);
		return registered ? relayResponse(200, registered) : relayError(403, 'forbidden');
	}

	private async run(
		operation: string,
		call: RelayManageOwner | RelayManageDevice,
		host: HostRecord
	): Promise<Response> {
		if (operation === 'summary') return relayResponse(200, this.registry.summary(host));
		if ('deviceId' in call) this.revocation.revoke(call.deviceId);
		else await this.registry.unregister();
		return relayResponse(200, { ok: true });
	}
}

async function certifies(hostKey: string, hostId: string): Promise<boolean> {
	try {
		return (await remoteIdentity(hostKey)) === hostId;
	} catch {
		return false;
	}
}
