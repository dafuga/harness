import { remotePatterns } from '../../../remote/src/index';
import type { RelayPairingRequest } from '../../../remote/src/index';
import { isRecord } from '../utils/isRecord';
import { matchesPattern } from '../utils/matchesPattern';

/** The public pairing bodies. They come from anyone, so a body with any other field is refused. */
export class PairingBodyValidator {
	request(value: unknown): RelayPairingRequest | undefined {
		if (!isRecord(value) || Object.keys(value).length !== 3) return undefined;
		const { ephemeralKey, sealed, challenge } = value;
		if (!matchesPattern(ephemeralKey, remotePatterns.key)) return undefined;
		if (!matchesPattern(sealed, remotePatterns.sealed)) return undefined;
		if (!matchesPattern(challenge, remotePatterns.challenge)) return undefined;
		return { ephemeralKey, sealed, challenge };
	}

	/** The verifier of an exchange: 32 random bytes as base64url, like a credential. */
	verifier(value: unknown): string | undefined {
		if (!isRecord(value) || Object.keys(value).length !== 1) return undefined;
		const verifier = value.verifier;
		return matchesPattern(verifier, remotePatterns.credential) ? verifier : undefined;
	}
}
