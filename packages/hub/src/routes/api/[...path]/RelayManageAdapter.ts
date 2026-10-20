import type {
	RelayManageDevice,
	RelayManageOwner,
	RelayManageRegister,
	RelayRegistered,
	RemoteHostSummary
} from '../../../../../remote/src/models/RemoteRelay.types';
import { hubFail } from '../../../utils/hubJson';
import { RelayReplyValidator } from '../../../validators/RelayReplyValidator';

export interface RelayManageAdapterConfig {
	/** The relay's host objects: one per host id. `/manage/*` is reachable through this only. */
	hosts: DurableObjectNamespace;
}

type Operation = 'register' | 'summary' | 'revoke-device' | 'unregister';

const MANAGE = 'https://relay.internal/manage/';
/** The relay refusals a caller may see, each only with the status it is defined for. */
const REFUSALS: Record<string, number> = { 'invalid-input': 400, forbidden: 403, 'not-found': 404 };

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

/**
 * Owner management of a host on the relay, through the namespace binding. Every operation is one
 * POST to the object named by the host id. Nothing of a request or an answer is logged.
 */
export class RelayManageAdapter {
	private readonly replies = new RelayReplyValidator();

	constructor(private readonly config: RelayManageAdapterConfig) {}

	async register(input: RelayManageRegister): Promise<RelayRegistered> {
		const { hostId, hostKey, credentialHash, name } = input;
		const body = { ...ownerOf(input), hostKey, credentialHash, name };
		return this.replies.registered(await this.manage('register', body), hostId);
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
	private async manage(operation: Operation, body: RelayManageOwner): Promise<unknown> {
		const response = await this.send(operation, body);
		const value = await jsonOf(response);
		return response.status === 200 ? value : refusal(response.status, value);
	}

	private async send(operation: Operation, body: RelayManageOwner): Promise<Response> {
		const { hosts } = this.config;
		const headers = { 'Content-Type': 'application/json' };
		const init = { method: 'POST', headers, body: JSON.stringify(body) };
		try {
			return await hosts.get(hosts.idFromName(body.hostId)).fetch(MANAGE + operation, init);
		} catch {
			return hubFail('unavailable');
		}
	}
}
