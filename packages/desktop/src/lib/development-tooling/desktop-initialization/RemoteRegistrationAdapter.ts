// @harness-uid u_l76zx7vxgv
import type { RemoteRegistrationAdapterConfig } from './RemoteRegistrationAdapter.types';
import { HubRegistrationError } from './RemoteRegistrationAdapter.types';
import type {
	RemoteHostRegisterInput,
	RemoteHostRegistration
} from '../../../../../remote/src/index';
import type { HostedFailureValidator } from '../../../validators/development-tooling/HostedFailureValidator';
import { HostedHttpAdapter } from '../../../adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
function signedOut(): Error {
	const error = new HubRegistrationError('Connect to Harness Hub on this computer first.');
	return Object.assign(error, { signedOut: true });
}
function registration(value: unknown, hostId: string): RemoteHostRegistration {
	const { origin, generation, registeredAt, ...rest } = (value ??
		{}) as Partial<RemoteHostRegistration>;
	const shaped = typeof origin === 'string' && typeof registeredAt === 'string';
	if (rest.hostId !== hostId || !shaped || !Number.isSafeInteger(generation))
		throw new HubRegistrationError('The hub answered with an invalid registration.');
	return { hostId, origin, generation: generation as number, registeredAt };
}

/** Registers this computer as a remote host under the hosted identity that is signed in here. */
export class RemoteRegistrationAdapter {
	constructor(private readonly config: RemoteRegistrationAdapterConfig) {}
	/** The hub takes the owner from the session. Only the four public fields are sent. */
	async register(
		input: RemoteHostRegisterInput,
		ownerId?: string
	): Promise<RemoteHostRegistration> {
		const { origin, credentials, fetch } = this.config;
		if (!origin) throw signedOut();
		const http = new HostedHttpAdapter({ origin, credentials, fetch });
		const credential = await http.authorize().catch(() => {
			throw signedOut();
		});
		if (ownerId && credential.principalId !== ownerId) throw signedOut();
		const { hostId, hostKey, credentialHash, name } = input,
			body = JSON.stringify({
				hostId,
				hostKey,
				credentialHash,
				name,
				...(ownerId && { accountLinked: true })
			});
		const response = await http
			.request('/api/remote/hosts', credential, { method: 'POST', body })
			.catch((error: HostedFailureValidator) => {
				throw error.status === 401 ? signedOut() : error;
			});
		return registration(await response.json(), hostId);
	}
	async unregister(hostId: string, ownerId: string): Promise<void> {
		const { origin, credentials, fetch } = this.config;
		if (!origin) throw signedOut();
		const http = new HostedHttpAdapter({ origin, credentials, fetch });
		const credential = await http.authorize();
		if (credential.principalId !== ownerId) throw signedOut();
		await http
			.request('/api/remote/hosts/' + hostId, credential, { method: 'DELETE', body: '{}' })
			.catch((error: HostedFailureValidator) => {
				if (error.status !== 404) throw error;
			});
	}
}

export type { RemoteRegistrationAdapterConfig } from './RemoteRegistrationAdapter.types';
