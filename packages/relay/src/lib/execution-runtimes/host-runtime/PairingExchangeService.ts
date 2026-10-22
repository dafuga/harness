import {
	credentialHash,
	pkceChallenge,
	randomCredential,
	relayCloseCodes,
	safeEqual
} from '../../../../../remote/src/index';
import type { RelayPairingExchange } from '../../../../../remote/src/index';
import type { HostSocketsAdapter } from './HostSocketsAdapter';
import type { HostStorageAdapter } from './HostStorageAdapter';
import type { PairingRecord } from '../../../models/networking-security/RelayHost.types';
import type { HostLinkService } from './HostLinkService';

/** Turns an approved pairing into the credential of a device, once. */
export class PairingExchangeService {
	constructor(
		private readonly store: HostStorageAdapter,
		private readonly sockets: HostSocketsAdapter,
		private readonly link: HostLinkService
	) {}

	/**
	 * Everything that takes time is computed first, from what the caller sent and from the device
	 * the pairing names. Then, without awaiting anything, the pairing is deleted, checked and
	 * turned into a device. Whatever comes of an attempt, there is no second one, and no other
	 * event of the object can slip in between the check and the credential.
	 */
	async exchange(
		pairingId: string,
		verifier: string | undefined
	): Promise<RelayPairingExchange | undefined> {
		const proof = verifier ? await pkceChallenge(verifier) : '';
		const hostId = this.store.host()?.hostId ?? '';
		const deviceId = this.store.pairing(pairingId)?.deviceId ?? '';
		const credential = randomCredential();
		const hash = await credentialHash({ role: 'device', hostId, deviceId, credential });
		const sealed = this.consume(pairingId, { proof, deviceId });
		if (sealed === undefined) return undefined;
		this.enroll(deviceId, hash);
		return { deviceId, credential, sealed };
	}

	/**
	 * Deletes the pairing before anything about it is compared, then checks it. Returns the sealed
	 * approval when the pairing was approved for the device the credential was prepared for and
	 * the caller proved that it holds the verifier.
	 */
	private consume(
		pairingId: string,
		claim: { proof: string; deviceId: string }
	): string | undefined {
		const pairing = this.store.pairing(pairingId);
		this.store.removePairing(pairingId);
		if (!pairing || !this.store.host()) return undefined;
		if (pairing.state !== 'approved' || pairing.expiresAt <= Date.now()) return undefined;
		if (!claim.deviceId || pairing.deviceId !== claim.deviceId) return undefined;
		return this.proven(pairing, claim.proof) ? pairing.approval : undefined;
	}

	private proven(pairing: PairingRecord, proof: string): boolean {
		return proof !== '' && safeEqual(pairing.challenge ?? '', proof);
	}

	/** Stores the hash of the new credential. A credential the device had before ends here. */
	private enroll(deviceId: string, hash: string): void {
		const generation = (this.store.device(deviceId)?.generation ?? 0) + 1;
		for (const socket of this.sockets.device(deviceId)) {
			this.link.drop(socket, relayCloseCodes.unauthorized);
		}
		const createdAt = new Date().toISOString();
		this.store.saveDevice({
			deviceId,
			credentialHash: hash,
			generation,
			createdAt,
			lastSeenAt: null
		});
	}
}
