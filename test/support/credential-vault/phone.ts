import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { VaultSealAdapter } from '../../../src/adapters/accounts-access/VaultSealAdapter';
import type { VaultApprovalBinding } from '../../../src/adapters/accounts-access/VaultSealAdapter.types';
import type {
	VaultDecision,
	VaultProof
} from '../../../src/validators/accounts-access/VaultWireValidator.types';

/** Synthetic canaries: a test fails if either string shows up outside the runner. */
export const canary = { password: 'canary-password-7f3a', otp: '424242' } as const;

/** A fake enrolled phone with a throwaway P-256 key; it signs and seals like Harness iOS. */
export class FakePhone {
	readonly seal = new VaultSealAdapter();
	private readonly pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
	constructor(readonly deviceId = 'test-iphone') {}

	get signingKey(): string {
		const jwk = this.pair.publicKey.export({ format: 'jwk' });
		const x = Buffer.from(jwk.x ?? '', 'base64url');
		const y = Buffer.from(jwk.y ?? '', 'base64url');
		return Buffer.concat([Buffer.from([4]), x, y]).toString('base64url');
	}

	/** Signs a decision with CB-DEVICE-V2 over the given binding and challenge nonce. */
	decide(
		origin: string,
		nonce: string,
		decision: VaultDecision,
		binding: VaultApprovalBinding
	): VaultProof {
		const payload = Buffer.from(JSON.stringify(decision)).toString('base64url');
		const unsigned = { deviceId: this.deviceId, nonce, payload };
		const input = this.seal.approvalSigningInput(origin, unsigned, binding);
		const signature = sign('sha256', input, {
			key: this.pair.privateKey,
			dsaEncoding: 'ieee-p1363'
		});
		return { ...unsigned, signature: signature.toString('base64url') };
	}

	/** Signs a V1 device proof, as the phone does for queue reads. */
	prove(origin: string, path: string, nonce: string, body: unknown = {}): VaultProof {
		const payload = Buffer.from(JSON.stringify(body)).toString('base64url');
		const unsigned = { deviceId: this.deviceId, nonce, payload };
		const input = this.seal.deviceSigningInput(origin, path, unsigned);
		const signature = sign('sha256', input, {
			key: this.pair.privateKey,
			dsaEncoding: 'ieee-p1363'
		});
		return { ...unsigned, signature: signature.toString('base64url') };
	}

	sealCanary(runnerPublicKey: string, requestId: string) {
		const plaintext = Buffer.from(JSON.stringify({ ...canary, token: null }));
		return this.seal.seal(runnerPublicKey, requestId, plaintext);
	}
}

export const randomNonce = () => randomBytes(32).toString('base64url');
