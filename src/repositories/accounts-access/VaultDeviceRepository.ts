// @harness-uid u_dbz3ravmb5
import { randomBytes, type KeyObject } from 'node:crypto';
import { VaultSealAdapter } from '../../adapters/accounts-access/VaultSealAdapter';
import type { VaultApprovalBinding } from '../../adapters/accounts-access/VaultSealAdapter.types';
import { VaultBrokerError } from '../../validators/accounts-access/VaultBrokerError';
import type { VaultProof } from '../../validators/accounts-access/VaultWireValidator.types';
import type {
	VaultChallenge,
	VaultDevice,
	VaultSignedChallengeScope
} from './VaultDeviceRepository.types';

export const vaultChallengeMs = 30_000;
const maxChallenges = 64;

/**
 * The enrolled phones and their outstanding single-use challenges. Every proof must answer a
 * challenge issued to the same device, inside its 30 s window, signed by the pinned key.
 */
export class VaultDeviceRepository {
	private readonly pins = new Map<string, { device: VaultDevice; key: KeyObject }>();
	private readonly challenges = new Map<
		string,
		{ device: string; expiresAt: number; path?: string }
	>();
	private readonly signedStarts = new Map<string, number>();

	constructor(
		devices: readonly VaultDevice[],
		private readonly origin: string,
		private readonly seal = new VaultSealAdapter(),
		private readonly now: () => number = Date.now
	) {
		for (const device of devices) {
			this.pins.set(device.id, { device, key: seal.signingKey(device.signingKey) });
		}
	}

	issue(deviceId: string): VaultChallenge {
		this.approver(deviceId);
		return this.issueFor(deviceId);
	}

	/** Verify the enrolled signer before minting a nonce scoped to its requested path. */
	issueSigned(proof: VaultProof, scope: VaultSignedChallengeScope): VaultChallenge {
		this.verifyProof(this.approver(proof.deviceId).key, scope.requestPath, proof);
		const now = this.now();
		if (scope.expiresAt <= now || scope.expiresAt > now + vaultChallengeMs) this.refuse();
		for (const [nonce, expiresAt] of this.signedStarts) {
			if (expiresAt <= now) this.signedStarts.delete(nonce);
		}
		if (this.signedStarts.has(proof.nonce)) this.refuse();
		if (this.signedStarts.size >= maxChallenges) {
			throw new VaultBrokerError(429, 'Too many device challenges.');
		}
		const challenge = this.issueFor(proof.deviceId, scope.responsePath);
		this.signedStarts.set(proof.nonce, scope.expiresAt);
		return challenge;
	}

	private issueFor(deviceId: string, path?: string): VaultChallenge {
		const now = this.now();
		for (const [nonce, entry] of this.challenges) {
			if (entry.expiresAt <= now) this.challenges.delete(nonce);
		}
		if (this.challenges.size >= maxChallenges) {
			throw new VaultBrokerError(429, 'Too many device challenges.');
		}
		const nonce = randomBytes(32).toString('base64url');
		const expiresAt = now + vaultChallengeMs;
		this.challenges.set(nonce, { device: deviceId, expiresAt, path });
		return { nonce, expiresAt };
	}

	/** Verifies a V1 proof for a device route such as the queue read. */
	authenticate(path: string, proof: VaultProof): void {
		const { key } = this.approver(proof.deviceId);
		this.consume(proof, path);
		this.verifyProof(key, path, proof);
	}

	/** Verifies a V2 decision proof against the scope the broker recorded for the request. */
	authenticateDecision(proof: VaultProof, binding: VaultApprovalBinding): void {
		const { key } = this.approver(proof.deviceId);
		this.consume(proof, '/v1/device/decision');
		const input = this.seal.approvalSigningInput(this.origin, proof, binding);
		if (!this.seal.isAuthentic(key, input, proof.signature)) this.refuse();
	}

	private verifyProof(key: KeyObject, path: string, proof: VaultProof): void {
		const input = this.seal.deviceSigningInput(this.origin, path, proof);
		if (!this.seal.isAuthentic(key, input, proof.signature)) this.refuse();
	}

	private consume(proof: VaultProof, path: string): void {
		const challenge = this.challenges.get(proof.nonce);
		this.challenges.delete(proof.nonce);
		if (
			challenge?.device !== proof.deviceId ||
			challenge.expiresAt <= this.now() ||
			(challenge.path !== undefined && challenge.path !== path)
		) {
			this.refuse();
		}
	}

	private approver(deviceId: string) {
		const pin = this.pins.get(deviceId);
		if (!pin) throw new VaultBrokerError(401, 'Device is not enrolled.');
		if (pin.device.role !== 'approver') {
			throw new VaultBrokerError(403, 'The device role does not allow approvals.');
		}
		return pin;
	}

	private refuse(): never {
		throw new VaultBrokerError(401, 'Device proof is invalid or expired.');
	}
}

export type { VaultChallenge, VaultDevice } from './VaultDeviceRepository.types';
