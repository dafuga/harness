// @harness-uid u_s5yfdrdvhw
import type { SealedDeviceKeys } from '../../models/networking-security/Sealed.types';
import { SealedError } from '../../models/networking-security/SealedError';
import {
	bytesText,
	concatBytes,
	cryptoSource,
	fromBase64Url,
	remoteBytes,
	toBase64Url
} from './remoteBytes';
import { sealedKemCurve, sealedSigningCurve } from './sealedDevice';
import type { RecoveryMaterial } from './sealedRecovery.types';

/** 32 random bytes. Daniel keeps them in the Credential Vault; the server never sees them. */
export function newRecoverySecret(): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(32));
}

async function recoveryKey(secret: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
	if (secret.length !== 32) throw new SealedError('Recovery secret must be 32 bytes.');
	const base = await crypto.subtle.importKey('raw', cryptoSource(secret), 'HKDF', false, [
		'deriveKey'
	]);
	const parameters = {
		name: 'HKDF',
		hash: 'SHA-256',
		salt: cryptoSource(salt),
		info: cryptoSource(remoteBytes('harness/sealed/v1/recovery'))
	};
	return crypto.subtle.deriveKey(parameters, base, { name: 'AES-GCM', length: 256 }, false, [
		'encrypt',
		'decrypt'
	]);
}

async function privateD(pair: CryptoKeyPair): Promise<string> {
	const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
	if (typeof jwk.d !== 'string') throw new SealedError('Recovery device keys must be extractable.');
	return jwk.d;
}

/** Seals the recovery device's private keys: base64url(salt 16 ‖ nonce 12 ‖ AES-256-GCM). */
export async function sealedRecovery(
	secret: Uint8Array,
	device: SealedDeviceKeys
): Promise<string> {
	const material: RecoveryMaterial = {
		deviceId: device.deviceId,
		kemD: await privateD(device.kem),
		signingD: await privateD(device.signing),
		kemPublic: toBase64Url(device.kemPublic),
		signingPublic: toBase64Url(device.signingPublic)
	};
	const salt = crypto.getRandomValues(new Uint8Array(16)),
		nonce = crypto.getRandomValues(new Uint8Array(12));
	const parameters = {
		name: 'AES-GCM',
		iv: cryptoSource(nonce),
		additionalData: cryptoSource(salt)
	};
	const plain = remoteBytes(JSON.stringify(material));
	const sealed = await crypto.subtle.encrypt(
		parameters,
		await recoveryKey(secret, salt),
		cryptoSource(plain)
	);
	return toBase64Url(concatBytes(salt, nonce, new Uint8Array(sealed)));
}

async function importPair(
	curve: EcKeyImportParams,
	d: string,
	publicKey: Uint8Array,
	usages: KeyUsage[]
): Promise<CryptoKeyPair> {
	const jwk = {
		kty: 'EC',
		crv: 'P-256',
		d,
		x: toBase64Url(publicKey.subarray(1, 33)),
		y: toBase64Url(publicKey.subarray(33))
	};
	const privateUsages = usages.filter((usage) => usage !== 'verify');
	const privateKey = await crypto.subtle.importKey('jwk', jwk, curve, false, privateUsages);
	const publicUsages = usages.includes('verify') ? (['verify'] as KeyUsage[]) : [];
	const publicKeyObject = await crypto.subtle.importKey(
		'raw',
		cryptoSource(publicKey),
		curve,
		true,
		publicUsages
	);
	return { privateKey, publicKey: publicKeyObject };
}

/** Opens the recovery blob into non-extractable device keys. A wrong secret throws. */
export async function openSealedRecovery(
	secret: Uint8Array,
	blob: string
): Promise<SealedDeviceKeys> {
	const bytes = fromBase64Url(blob);
	const salt = bytes.slice(0, 16),
		parameters = {
			name: 'AES-GCM',
			iv: cryptoSource(bytes.slice(16, 28)),
			additionalData: cryptoSource(salt)
		};
	let material: RecoveryMaterial;
	try {
		const plain = await crypto.subtle.decrypt(
			parameters,
			await recoveryKey(secret, salt),
			cryptoSource(bytes.slice(28))
		);
		material = JSON.parse(bytesText(new Uint8Array(plain))) as RecoveryMaterial;
	} catch {
		throw new SealedError('Recovery secret does not open this blob.');
	}
	const kemPublic = fromBase64Url(material.kemPublic),
		signingPublic = fromBase64Url(material.signingPublic);
	return {
		deviceId: material.deviceId,
		kem: await importPair(sealedKemCurve, material.kemD, kemPublic, ['deriveBits']),
		signing: await importPair(sealedSigningCurve, material.signingD, signingPublic, [
			'sign',
			'verify'
		]),
		kemPublic,
		signingPublic
	};
}
