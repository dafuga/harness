// @harness-uid u_h2md5jbkhk
import type {
	ScopeKeys,
	SealedJsonValue,
	SealedRecordHeader
} from '../../models/networking-security/Sealed.types';
import { SealedError } from '../../models/networking-security/SealedError';
import { bytesText, concatBytes, cryptoSource, remoteBytes, toHex } from './remoteBytes';
import { sealedPadding, sealedUnpadding } from './sealedPadding';
import { sealedU32 } from './sealedScopeKeys';

const recordVersion = 1,
	headerLength = 61,
	prefixLength = headerLength + 16 + 12,
	recordInfo = remoteBytes('harness/sealed/v1/record');

/** Version ‖ scope id 16 ‖ epoch u32 ‖ object id 32 ‖ revision u64, all authenticated. */
export function recordHeaderBytes(header: SealedRecordHeader): Uint8Array {
	if (header.scopeId.length !== 16 || header.objectId.length !== 32)
		throw new SealedError('Record header ids have the wrong size.');
	if (header.revision < 0n || header.revision > 0xffffffffffffffffn)
		throw new SealedError('Revision is out of range.');
	const revision = new Uint8Array(8);
	new DataView(revision.buffer).setBigUint64(0, header.revision);
	const version = Uint8Array.of(recordVersion);
	return concatBytes(version, header.scopeId, sealedU32(header.epoch), header.objectId, revision);
}

/** Reads the clear header of an envelope so a client can pick its keys. Contents stay sealed. */
export function sealedRecordHeader(envelope: Uint8Array): SealedRecordHeader {
	if (envelope.length < prefixLength + 16 || envelope[0] !== recordVersion)
		throw new SealedError('Not a sealed v1 record.');
	const view = new DataView(envelope.buffer, envelope.byteOffset, envelope.length);
	return {
		scopeId: envelope.slice(1, 17),
		epoch: view.getUint32(17),
		objectId: envelope.slice(21, 53),
		revision: view.getBigUint64(53)
	};
}

async function recordKey(keys: ScopeKeys, salt: Uint8Array, use: KeyUsage): Promise<CryptoKey> {
	const parameters = {
		name: 'HKDF',
		hash: 'SHA-256',
		salt: cryptoSource(salt),
		info: cryptoSource(recordInfo)
	};
	return crypto.subtle.deriveKey(
		parameters,
		keys.dataKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		[use]
	);
}

/** Seals a JSON value under the scope's current keys with a fresh per-object key and nonce. */
export async function sealedRecord(
	keys: ScopeKeys,
	header: Omit<SealedRecordHeader, 'scopeId' | 'epoch'>,
	value: SealedJsonValue
): Promise<Uint8Array> {
	const full = { ...header, scopeId: keys.scopeId, epoch: keys.epoch };
	const salt = crypto.getRandomValues(new Uint8Array(16)),
		nonce = crypto.getRandomValues(new Uint8Array(12));
	const prefix = concatBytes(recordHeaderBytes(full), salt, nonce);
	const plain = sealedPadding(remoteBytes(JSON.stringify(value)));
	const parameters = {
		name: 'AES-GCM',
		iv: cryptoSource(nonce),
		additionalData: cryptoSource(prefix)
	};
	const key = await recordKey(keys, salt, 'encrypt');
	const sealed = await crypto.subtle.encrypt(parameters, key, cryptoSource(plain));
	return concatBytes(prefix, new Uint8Array(sealed));
}

/** Opens an envelope sealed for these keys. Any changed byte, or other keys, throws. */
export async function openSealedRecord<T = unknown>(
	keys: ScopeKeys,
	envelope: Uint8Array
): Promise<{ header: SealedRecordHeader; value: T }> {
	const header = sealedRecordHeader(envelope);
	if (toHex(header.scopeId) !== toHex(keys.scopeId) || header.epoch !== keys.epoch)
		throw new SealedError('Record belongs to other scope keys.');
	const prefix = envelope.subarray(0, prefixLength);
	const parameters = {
		name: 'AES-GCM',
		iv: cryptoSource(envelope.slice(headerLength + 16, prefixLength)),
		additionalData: cryptoSource(prefix)
	};
	const key = await recordKey(keys, envelope.slice(headerLength, headerLength + 16), 'decrypt');
	let plain: ArrayBuffer;
	try {
		plain = await crypto.subtle.decrypt(
			parameters,
			key,
			cryptoSource(envelope.slice(prefixLength))
		);
	} catch {
		throw new SealedError('Record failed authentication.');
	}
	return { header, value: JSON.parse(bytesText(sealedUnpadding(new Uint8Array(plain)))) as T };
}
