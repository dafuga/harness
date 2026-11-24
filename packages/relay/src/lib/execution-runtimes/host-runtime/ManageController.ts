// @harness-uid u_x6cd7l3yp6
import { remoteIdentity, remotePatterns } from '../../../../../remote/src/index';
import type { RelayManageDevice, RelayManageOwner } from '../../../../../remote/src/index';
import type { HostStorageAdapter } from './HostStorageAdapter';
import type { HostRecord, HostScope } from '../../../models/networking-security/RelayHost.types';
import type { DeviceRevocationService } from './DeviceRevocationService';
import type { HostRegistryService } from './HostRegistryService';
import { readJsonBody } from '../../../utils/development-tooling/readJsonBody';
import { relayError, relayResponse } from '../../../utils/networking-security/relayResponse';
import type { PairingAccessService } from './PairingAccessService';
import { PairingBodyValidator } from '../../../validators/networking-security/PairingBodyValidator';
import { ManageBodyValidator } from '../../../validators/development-tooling/ManageBodyValidator';

const operations = [
	'register',
	'summary',
	'revoke-device',
	'unregister',
	'directory-list',
	'directory-add',
	'directory-remove',
	'pairing-key',
	'pairing-request'
];

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
		private readonly services: {
			revocation: DeviceRevocationService;
			pairing: PairingAccessService;
		}
	) {}

	async handle(request: Request, operation: string): Promise<Response> {
		if (request.method !== 'POST' || !operations.includes(operation)) {
			return relayError(404, 'not-found');
		}
		const body = await readJsonBody(request, false);
		if (operation === 'register') return this.register(body);
		if (operation.startsWith('directory-')) return this.directory(operation, body);
		const call =
			operation === 'revoke-device' ? this.validator.device(body) : this.validator.owner(body);
		if (!call) return relayError(400, 'invalid-input');
		const host = this.store.host();
		if (!host || host.hostId !== call.hostId) return relayError(404, 'not-found');
		if (host.ownerId !== call.owner.id) return relayError(403, 'forbidden');
		if (operation === 'pairing-key')
			return relayResponse(200, { hostId: host.hostId, hostKey: host.hostKey });
		if (operation === 'pairing-request') return this.accountRequest(body, host, call.holder);
		return this.run(operation, call, host);
	}

	ownsAccount(hostId: string, ownerId: string): boolean {
		const host = this.store.host();
		return host?.accountLinked === true && host.hostId === hostId && host.ownerId === ownerId;
	}

	private async accountRequest(
		body: Record<string, unknown> | undefined,
		host: HostRecord,
		holder?: string
	): Promise<Response> {
		const linked = host.accountLinked ? holder : undefined;
		if (host.accountLinked && (!linked || this.store.revokedHolder(linked)))
			return relayError(403, 'forbidden');
		const { pairingId, request } = body ?? {};
		const input = new PairingBodyValidator().request(request);
		if (typeof pairingId !== 'string' || !remotePatterns.pairingId.test(pairingId) || !input)
			return relayError(400, 'invalid-input');
		const pending = await this.services.pairing.requestAccount(pairingId, input, linked);
		return pending ? relayResponse(200, pending) : relayError(409, 'pairing-unavailable');
	}

	private directory(operation: string, body: unknown): Response {
		const { owner, hostId } = (body ?? {}) as { owner?: { id?: unknown }; hostId?: unknown };
		if (typeof owner?.id !== 'string' || !this.scope.owns(`owner:${owner.id}`))
			return relayError(403, 'forbidden');
		if (operation === 'directory-list') return relayResponse(200, this.store.directoryHosts());
		if (typeof hostId !== 'string' || !remotePatterns.hostId.test(hostId))
			return relayError(400, 'invalid-input');
		if (operation === 'directory-add') this.store.rememberHost(hostId);
		else this.store.forgetHost(hostId);
		return relayResponse(200, { ok: true });
	}

	/** A host id is the hash of its key, and an object registers only the host it is named after. */
	private async register(body: unknown): Promise<Response> {
		const input = this.validator.register(body);
		if (!input || !this.scope.owns(input.hostId)) return relayError(400, 'invalid-input');
		if (!(await certifies(input.hostKey, input.hostId))) return relayError(400, 'invalid-input');
		const current = this.store.host();
		if (current && current.ownerId !== input.owner.id) return relayError(403, 'forbidden');
		const indexed = await this.updateDirectory('add', input.owner.id, input.hostId);
		if (!indexed) return relayResponse(503, { error: 'unavailable' });
		const registered = this.registry.register(input);
		return registered ? relayResponse(200, registered) : relayError(403, 'forbidden');
	}

	/** Reconnects also index registrations that predate the owner directory. */
	async index(host: HostRecord): Promise<boolean> {
		return this.updateDirectory('add', host.ownerId, host.hostId);
	}

	private async updateDirectory(operation: 'add' | 'remove', ownerId: string, hostId: string) {
		const reply = await this.scope
			.directory(ownerId)
			.fetch(`https://relay.internal/manage/directory-${operation}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ owner: { id: ownerId }, hostId })
			})
			.catch(() => null);
		return reply?.ok === true;
	}

	private async run(
		operation: string,
		call: RelayManageOwner | RelayManageDevice,
		host: HostRecord
	): Promise<Response> {
		if (operation === 'summary') return relayResponse(200, this.registry.summary(host));
		if ('deviceId' in call) this.services.revocation.revoke(call.deviceId);
		else {
			await this.registry.unregister();
			await this.updateDirectory('remove', host.ownerId, host.hostId);
		}
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
