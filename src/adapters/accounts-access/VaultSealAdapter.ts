// @harness-uid u_cepoq63qyy
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	createPublicKey,
	diffieHellman,
	generateKeyPairSync,
	hkdfSync,
	randomBytes,
	verify,
	type KeyObject
} from 'node:crypto';
import { ExpectedCliError } from '../../core/development-tooling/errors';
import type {
	VaultProof,
	VaultSealed
} from '../../validators/accounts-access/VaultWireValidator.types';
import type { VaultApprovalBinding, VaultRunnerKey } from './VaultSealAdapter.types';

const sealInfo = Buffer.from('credential-broker/seal/v1', 'ascii');
const nonce = Buffer.alloc(12);

/**
 * The broker's envelope algorithms, byte-compatible with credential-broker v1: P-256 device
 * proofs, X25519 agreement, HKDF-SHA256 and ChaCha20-Poly1305 with the request ID as AAD.
 * CB-DEVICE-V2 approvals also bind the recipe digest, runner, method and lease scope.
 */
export class VaultSealAdapter {
	hash(bytes: Uint8Array): string {
		return createHash('sha256').update(bytes).digest('hex');
	}

	keyFingerprint(publicKey: string): string {
		return this.hash(Buffer.from(publicKey, 'base64url'));
	}

	/** CB-DEVICE-V1 input, unchanged from the broker so existing phones keep verifying. */
	deviceSigningInput(origin: string, path: string, proof: Omit<VaultProof, 'signature'>): Buffer {
		const payload = this.hash(Buffer.from(proof.payload, 'base64url'));
		const fields = ['CB-DEVICE-V1', origin, path, proof.deviceId, proof.nonce, payload];
		return Buffer.from(fields.join('\n'), 'ascii');
	}

	/** CB-DEVICE-V2 input for a decision: V1 fields plus the scope the phone approved. */
	approvalSigningInput(
		origin: string,
		proof: Omit<VaultProof, 'signature'>,
		binding: VaultApprovalBinding
	): Buffer {
		const v1 = this.deviceSigningInput(origin, '/v1/device/decision', proof).toString('ascii');
		const scope = binding.mode + ':' + binding.leaseMs;
		const fields = [v1.replace(/^CB-DEVICE-V1/u, 'CB-DEVICE-V2'), binding.recipeDigest];
		fields.push(binding.runnerFingerprint, binding.method, scope);
		return Buffer.from(fields.join('\n'), 'ascii');
	}

	/** An uncompressed P-256 point (65 bytes, base64url) as a verification key. */
	signingKey(encoded: string): KeyObject {
		const raw = Buffer.from(encoded, 'base64url');
		if (raw.length !== 65 || raw[0] !== 4) throw new ExpectedCliError('Invalid device key.');
		const jwk = {
			kty: 'EC',
			crv: 'P-256',
			x: raw.subarray(1, 33).toString('base64url'),
			y: raw.subarray(33).toString('base64url')
		};
		return createPublicKey({ format: 'jwk', key: jwk });
	}

	isAuthentic(key: KeyObject, input: Buffer, signature: string): boolean {
		const options = { key, dsaEncoding: 'ieee-p1363' as const };
		return verify('sha256', input, options, Buffer.from(signature, 'base64url'));
	}

	/** Seals plaintext to a recipient X25519 key, as the phone does for a runner. */
	seal(recipientPublicKey: string, requestId: string, plaintext: Uint8Array): VaultSealed {
		const sender = generateKeyPairSync('x25519');
		const salt = randomBytes(32).toString('base64url');
		const key = this.derive(sender.privateKey, recipientPublicKey, salt);
		try {
			const cipher = createCipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
			cipher.setAAD(Buffer.from(requestId, 'ascii'), { plaintextLength: plaintext.length });
			const body = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
			const senderPublicKey = sender.publicKey.export({ format: 'jwk' }).x ?? '';
			return { senderPublicKey, salt, ciphertext: body.toString('base64url') };
		} finally {
			key.fill(0);
		}
	}

	/** Opens a sealed envelope; any failure is one generic error so nothing leaks. */
	open(privateKey: KeyObject, requestId: string, sealed: VaultSealed): Buffer {
		let key: Buffer | undefined;
		try {
			key = this.derive(privateKey, sealed.senderPublicKey, sealed.salt);
			const combined = Buffer.from(sealed.ciphertext, 'base64url');
			const decipher = createDecipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
			decipher.setAAD(Buffer.from(requestId, 'ascii'), { plaintextLength: combined.length - 16 });
			decipher.setAuthTag(combined.subarray(-16));
			return Buffer.concat([decipher.update(combined.subarray(0, -16)), decipher.final()]);
		} catch {
			throw new ExpectedCliError('Could not open the phone approval.');
		} finally {
			key?.fill(0);
		}
	}

	/** A fresh one-time runner key: its private half opens exactly one envelope. */
	runnerKey(): VaultRunnerKey {
		const pair = generateKeyPairSync('x25519');
		let privateKey: KeyObject | undefined = pair.privateKey;
		const publicKey = pair.publicKey.export({ format: 'jwk' }).x ?? '';
		return {
			publicKey,
			fingerprint: this.keyFingerprint(publicKey),
			open: (requestId, sealed) => {
				const key = privateKey;
				privateKey = undefined;
				if (!key) throw new ExpectedCliError('The runner key was already used.');
				return this.open(key, requestId, sealed);
			}
		};
	}

	private derive(privateKey: KeyObject, publicKey: string, salt: string): Buffer {
		const peer = createPublicKey({
			format: 'jwk',
			key: { kty: 'OKP', crv: 'X25519', x: publicKey }
		});
		const shared = diffieHellman({ privateKey, publicKey: peer });
		try {
			if (shared.every((byte) => byte === 0))
				throw new ExpectedCliError('Invalid X25519 agreement.');
			return Buffer.from(hkdfSync('sha256', shared, Buffer.from(salt, 'base64url'), sealInfo, 32));
		} finally {
			shared.fill(0);
		}
	}
}

export type { VaultApprovalBinding, VaultRunnerKey } from './VaultSealAdapter.types';
