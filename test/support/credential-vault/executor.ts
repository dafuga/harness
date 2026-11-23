import { generateKeyPairSync, sign } from 'node:crypto';
import { executorSigningInput } from '../../../src/services/accounts-access/VaultRunnerPreflightService';
import type { VaultRunnerPreflightScope } from '../../../src/services/accounts-access/VaultRunnerPreflightService.types';
import type { VaultSessionRequest } from '../../../src/validators/accounts-access/VaultWireValidator.types';

export function syntheticExecutor(host = 'mb2') {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	return {
		pin: { host, publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString() },
		attest(request: VaultSessionRequest, scope: VaultRunnerPreflightScope) {
			const signature = sign(null, executorSigningInput(request, scope), privateKey);
			return { ...scope, signature: signature.toString('base64url') };
		}
	};
}
