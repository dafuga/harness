// @harness-uid u_6qzr7a2fxr
import { createPublicKey, randomBytes, verify, type KeyObject } from 'node:crypto';
import { canonical } from '../../core/execution-runtimes/scripted-deploy/contracts';
import { VaultBrokerError } from '../../validators/accounts-access/VaultBrokerError';
import type {
	VaultRunnerPreflight,
	VaultSessionRequest
} from '../../validators/accounts-access/VaultWireValidator.types';
import type {
	VaultExecutorPin,
	VaultRunnerPreflightScope
} from './VaultRunnerPreflightService.types';

const maxAgeMs = 120_000;

/** Verifies a receipt from the isolated executor before a request can reach the phone. */
export class VaultRunnerPreflightService {
	readonly brokerId = randomBytes(32).toString('base64url');
	private readonly keys = new Map<string, KeyObject>();

	constructor(
		pins: readonly VaultExecutorPin[],
		private readonly now = Date.now
	) {
		for (const { host, publicKey } of pins) {
			const key = createPublicKey(publicKey);
			if (key.asymmetricKeyType !== 'ed25519' || this.keys.has(host)) {
				throw new VaultBrokerError(500, 'Invalid executor trust configuration.');
			}
			this.keys.set(host, key);
		}
	}

	verify(request: VaultSessionRequest, uid: number | null, proof?: VaultRunnerPreflight): number {
		const key = this.keys.get(request.host);
		if (!proof || !key || uid === null || uid <= 0) this.refuse();
		const { signature, ...scope } = proof;
		const now = this.now();
		if (
			scope.brokerId !== this.brokerId ||
			scope.uid !== uid ||
			!validAt(scope, now) ||
			!verify(null, executorSigningInput(request, scope), key, Buffer.from(signature, 'base64url'))
		)
			this.refuse();
		return scope.expiresAt;
	}

	private refuse(): never {
		throw new VaultBrokerError(403, 'A valid executor preflight is required.');
	}
}

function validAt({ issuedAt, expiresAt }: VaultRunnerPreflightScope, now: number): boolean {
	return issuedAt <= now && now < expiresAt && expiresAt - issuedAt <= maxAgeMs;
}

/** The executor signs the entire request, including the key it generated for that runner. */
export function executorSigningInput(
	request: VaultSessionRequest,
	scope: VaultRunnerPreflightScope
) {
	return Buffer.from(canonical({ kind: 'vault-runner-preflight-v1', request, ...scope }));
}
