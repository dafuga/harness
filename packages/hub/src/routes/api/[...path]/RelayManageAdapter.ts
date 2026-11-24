// @harness-uid u_kqcz5yforb
import type {
	RelayManageAdapterConfig,
	Operation,
	BrowserPairingCall
} from './RelayManageAdapter.types';
import type {
	RelayManageDevice,
	RelayManageOwner,
	RelayManagePairingRequest,
	RelayManageRegister,
	RelayRegistered,
	RemoteHostSummary
} from '../../../../../remote/src/models/networking-security/RemoteRelay.types';
import { remotePatterns } from '../../../../../remote/src/utils/remoteIdentity';
import { hubFail } from '../../../utils/development-tooling/hubJson';
import { RelayReplyValidator } from '../../../validators/networking-security/RelayReplyValidator';

const MANAGE = 'https://relay.internal/manage/';
/** The relay refusals a caller may see, each only with the status it is defined for. */
const REFUSALS: Record<string, number> = {
	'invalid-input': 400,
	forbidden: 403,
	'not-found': 404,
	'pairing-unavailable': 409
};

/** The owner and the host, field by field: whatever else the caller's object holds stays here. */
function ownerOf(input: RelayManageOwner): RelayManageOwner {
	return { owner: { id: input.owner.id }, hostId: input.hostId };
}

async function jsonOf(response: Response): Promise<unknown> {
	try {
		return (await response.json()) as unknown;
	} catch {
		return hubFail('unavailable');
	}
}

function refusal(status: number, value: unknown): never {
	const error = (value as { error?: unknown } | null)?.error;
	const known = typeof error === 'string' && Object.hasOwn(REFUSALS, error);
	return hubFail(known && REFUSALS[error as string] === status ? (error as string) : 'unavailable');
}

async function fetchRelay(
	hosts: DurableObjectNamespace,
	name: string,
	path: string,
	init: RequestInit
): Promise<Response> {
	try {
		return await hosts.get(hosts.idFromName(name)).fetch(path, init);
	} catch {
		return hubFail('unavailable');
	}
}

function browser(
	hosts: DurableObjectNamespace,
	input: RelayManageOwner,
	route: string,
	init: RequestInit
): Promise<Response> {
	const headers = new Headers(init.headers);
	headers.set('X-Harness-Account-Owner', input.owner.id);
	headers.set('X-Harness-Account-Session', input.holder ?? '');
	const path = `https://relay.internal/account/v1/hosts/${input.hostId}/${route}`;
	return fetchRelay(hosts, input.hostId, path, { ...init, headers });
}

/**
 * Owner management of a host on the relay, through the namespace binding. Every operation is one
 * POST to the object named by the host id. Nothing of a request or an answer is logged.
 */
export class RelayManageAdapter {
	private readonly replies = new RelayReplyValidator();

	constructor(private readonly config: RelayManageAdapterConfig) {}

	async register(input: RelayManageRegister): Promise<RelayRegistered> {
		const { hostId, hostKey, credentialHash, name, accountLinked, holder } = input;
		const body = { ...ownerOf(input), hostKey, credentialHash, name, accountLinked, holder };
		return this.replies.registered(await this.manage('register', body), hostId);
	}

	async pairingKey(input: RelayManageOwner) {
		const result = (await this.manage('pairing-key', ownerOf(input))) as {
			hostId?: unknown;
			hostKey?: unknown;
		} | null;
		if (
			result?.hostId !== input.hostId ||
			typeof result.hostKey !== 'string' ||
			!remotePatterns.key.test(result.hostKey)
		)
			return hubFail('unavailable');
		return { hostId: input.hostId, hostKey: result.hostKey };
	}

	async requestPairing(input: RelayManageOwner, body: RelayManagePairingRequest) {
		const { pairingId, ephemeralKey, sealed, challenge } = body;
		const request = { ephemeralKey, sealed, challenge };
		const result = (await this.manage('pairing-request', {
			...ownerOf(input),
			holder: input.holder,
			pairingId,
			request
		})) as {
			state?: unknown;
			expiresAt?: unknown;
		} | null;
		if (
			result?.state !== 'requested' ||
			typeof result.expiresAt !== 'string' ||
			!Number.isFinite(Date.parse(result.expiresAt))
		)
			return hubFail('unavailable');
		return { state: result.state, expiresAt: result.expiresAt };
	}

	async browserPairing(input: RelayManageOwner, call: BrowserPairingCall): Promise<Response> {
		const { pairingId, operation, proof } = call;
		const headers = { 'Content-Type': 'application/json' };
		const init = { method: 'POST', headers, body: JSON.stringify(proof) };
		return browser(this.config.hosts, input, `pairings/${pairingId}/${operation}`, init);
	}

	async browserSocket(input: RelayManageDevice): Promise<Response> {
		const headers = { Upgrade: 'websocket', 'X-Harness-Account-Device': input.deviceId };
		return browser(this.config.hosts, input, 'connect', { headers });
	}

	async computers(owner: RelayManageOwner['owner'], accountOnly = false) {
		const reply = await this.send('directory-list', { owner }, `owner:${owner.id}`);
		const ids = await jsonOf(reply);
		if (
			reply.status !== 200 ||
			!Array.isArray(ids) ||
			!ids.every((id: unknown) => typeof id === 'string' && remotePatterns.hostId.test(id))
		)
			return hubFail('unavailable');
		const computers = [];
		for (const hostId of ids as string[]) {
			const computer = await this.discover(owner, hostId, accountOnly);
			if (computer) computers.push(computer);
		}
		return computers;
	}

	private async discover(owner: RelayManageOwner['owner'], hostId: string, accountOnly: boolean) {
		try {
			const { name, online, accountLinked } = await this.summary({ owner, hostId });
			return accountOnly && !accountLinked ? null : { hostId, name, online };
		} catch (error) {
			const code = (error as { code?: string }).code;
			if (code === 'not-found' || code === 'forbidden') return null;
			throw error;
		}
	}

	async summary(input: RelayManageOwner): Promise<RemoteHostSummary> {
		return this.replies.summary(await this.manage('summary', ownerOf(input)), input.hostId);
	}

	async revokeDevice(input: RelayManageDevice): Promise<{ ok: true }> {
		const body = { ...ownerOf(input), deviceId: input.deviceId };
		return this.replies.done(await this.manage('revoke-device', body));
	}

	async unregister(input: RelayManageOwner): Promise<{ ok: true }> {
		return this.replies.done(await this.manage('unregister', ownerOf(input)));
	}

	/** The JSON of a `200`. The three defined refusals keep their code; the rest is `unavailable`. */
	private async manage(
		operation: Operation,
		body: RelayManageOwner & { pairingId?: unknown; request?: unknown }
	): Promise<unknown> {
		const response = await this.send(operation, body);
		const value = await jsonOf(response);
		return response.status === 200 ? value : refusal(response.status, value);
	}

	private async send(
		operation: Operation,
		body: { owner: RelayManageOwner['owner']; hostId?: string },
		name = body.hostId ?? ''
	): Promise<Response> {
		const { hosts } = this.config;
		const headers = { 'Content-Type': 'application/json' };
		const init = { method: 'POST', headers, body: JSON.stringify(body) };
		return fetchRelay(hosts, name, MANAGE + operation, init);
	}
}

export type { RelayManageAdapterConfig } from './RelayManageAdapter.types';
