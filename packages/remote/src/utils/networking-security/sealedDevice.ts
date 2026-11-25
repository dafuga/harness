// @harness-uid u_pb736ppmc5
import type {
	SealedDeviceKeys,
	SealedDevicePublic,
	SealedRole
} from '../../models/networking-security/Sealed.types';
import { toBase64Url } from './remoteBytes';

const kemCurve = { name: 'ECDH', namedCurve: 'P-256' } as const,
	signingCurve = { name: 'ECDSA', namedCurve: 'P-256' } as const;

async function rawPublic(pair: CryptoKeyPair): Promise<Uint8Array> {
	return new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
}

/**
 * A device's key-agreement and signing pairs. Private halves are non-extractable; only the
 * recovery device is made extractable, once, to seal it under the recovery secret.
 */
export async function sealedDevice(
	options: { extractable?: boolean } = {}
): Promise<SealedDeviceKeys> {
	const extractable = options.extractable === true;
	const kem = await crypto.subtle.generateKey(kemCurve, extractable, ['deriveBits']);
	const signing = await crypto.subtle.generateKey(signingCurve, extractable, ['sign', 'verify']);
	return {
		deviceId: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
		kem,
		signing,
		kemPublic: await rawPublic(kem),
		signingPublic: await rawPublic(signing)
	};
}

/** The chain's public view of a device. */
export function sealedDevicePublic(
	keys: SealedDeviceKeys,
	role: SealedRole,
	scopes: string[]
): SealedDevicePublic {
	return {
		deviceId: keys.deviceId,
		kemPublic: toBase64Url(keys.kemPublic),
		signingPublic: toBase64Url(keys.signingPublic),
		role,
		scopes: [...scopes].sort()
	};
}

export { kemCurve as sealedKemCurve, signingCurve as sealedSigningCurve };
