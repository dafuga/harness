import {
	credentialHash,
	exportRemoteKeys,
	importRemoteKeys,
	randomCredential,
	relayOrigin,
	remoteIdentity,
	remoteKeys
} from '../../../remote/src/index';
import type {
	RemoteHostRegisterInput,
	RemoteHostRegistration,
	RemoteKeyPair
} from '../../../remote/src/index';
import type { RemoteHostState } from '../adapters/RemoteHostStoreAdapter';

export type RegisterRemoteHost = (
	input: RemoteHostRegisterInput
) => Promise<RemoteHostRegistration>;

/** A new identity of this computer: a key pair, the id that key certifies, and a credential. */
export async function remoteHostIdentity(): Promise<RemoteHostState> {
	const pair = await remoteKeys();
	return {
		enabled: false,
		origin: null,
		hostId: await remoteIdentity(pair.publicKey),
		keys: await exportRemoteKeys(pair),
		credential: randomCredential(),
		generation: 0,
		devices: [],
		revoked: []
	};
}
/**
 * Registers the identity and marks the state enabled with the relay the hub named. The hub and
 * the relay learn the public key and a hash of the credential; nothing else leaves here.
 */
export async function registerRemoteHost(
	state: RemoteHostState,
	name: string,
	register: RegisterRemoteHost
): Promise<RemoteKeyPair> {
	const { hostId, credential } = state,
		keys = await importRemoteKeys(state.keys),
		hash = await credentialHash({ role: 'host', hostId, credential });
	const input = { hostId, hostKey: state.keys.publicKey, credentialHash: hash, name },
		registration = await register(input),
		origin = relayOrigin(registration.origin);
	if (!origin || registration.hostId !== hostId) throw new Error('The hub named no relay.');
	Object.assign(state, { enabled: true, origin, generation: registration.generation });
	return keys;
}
