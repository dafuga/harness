// @harness-uid u_yntfc4v6tj
import type { ScopeKeys, SealedFrameHeader } from '../../models/networking-security/Sealed.types';
import { SealedError } from '../../models/networking-security/SealedError';
import { concatBytes, cryptoSource, remoteBytes, toHex } from './remoteBytes';
import { sealedU32 } from './sealedScopeKeys';

const frameVersion = 2,
	headerLength = 45,
	streamInfo = remoteBytes('harness/sealed/v1/stream');

function frameHeaderBytes(header: SealedFrameHeader): Uint8Array {
	if (header.scopeId.length !== 16 || header.streamId.length !== 16)
		throw new SealedError('Frame header ids have the wrong size.');
	if (header.counter < 0n || header.counter > 0xffffffffffffffffn)
		throw new SealedError('Frame counter is out of range.');
	const counter = new Uint8Array(8);
	new DataView(counter.buffer).setBigUint64(0, header.counter);
	const version = Uint8Array.of(frameVersion);
	return concatBytes(version, header.scopeId, sealedU32(header.epoch), header.streamId, counter);
}

/** Reads the clear header of a frame. */
export function sealedFrameHeader(frame: Uint8Array): SealedFrameHeader {
	if (frame.length < headerLength + 16 || frame[0] !== frameVersion)
		throw new SealedError('Not a sealed v1 stream frame.');
	const view = new DataView(frame.buffer, frame.byteOffset, frame.length);
	return {
		scopeId: frame.slice(1, 17),
		epoch: view.getUint32(17),
		streamId: frame.slice(21, 37),
		counter: view.getBigUint64(37)
	};
}

/**
 * One AES-256-GCM key per stream, HKDF(dataKey, salt = stream id). Derive it once per stream and
 * reuse it for every frame; the counter makes each nonce unique.
 */
export async function sealedStreamKey(keys: ScopeKeys, streamId: Uint8Array): Promise<CryptoKey> {
	if (streamId.length !== 16) throw new SealedError('Stream id must be 16 bytes.');
	const parameters = {
		name: 'HKDF',
		hash: 'SHA-256',
		salt: cryptoSource(streamId),
		info: cryptoSource(streamInfo)
	};
	return crypto.subtle.deriveKey(
		parameters,
		keys.dataKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

function frameParameters(header: Uint8Array, counter: bigint): AesGcmParams {
	const nonce = new Uint8Array(12);
	new DataView(nonce.buffer).setBigUint64(4, counter);
	return { name: 'AES-GCM', iv: cryptoSource(nonce), additionalData: cryptoSource(header) };
}

/** Seals one chunk of session output. The caller never repeats a counter within a stream. */
export async function sealedFrame(
	keys: ScopeKeys,
	streamKey: CryptoKey,
	frame: { streamId: Uint8Array; counter: bigint; data: Uint8Array }
): Promise<Uint8Array> {
	const header = frameHeaderBytes({ ...frame, scopeId: keys.scopeId, epoch: keys.epoch });
	const sealed = await crypto.subtle.encrypt(
		frameParameters(header, frame.counter),
		streamKey,
		cryptoSource(frame.data)
	);
	return concatBytes(header, new Uint8Array(sealed));
}

/** Opens a frame of this stream. A changed byte, another stream or other keys throws. */
export async function openSealedFrame(
	keys: ScopeKeys,
	streamKey: CryptoKey,
	frame: Uint8Array
): Promise<{ header: SealedFrameHeader; data: Uint8Array }> {
	const header = sealedFrameHeader(frame);
	if (toHex(header.scopeId) !== toHex(keys.scopeId) || header.epoch !== keys.epoch)
		throw new SealedError('Frame belongs to other scope keys.');
	const parameters = frameParameters(frame.subarray(0, headerLength), header.counter);
	try {
		const plain = await crypto.subtle.decrypt(
			parameters,
			streamKey,
			cryptoSource(frame.slice(headerLength))
		);
		return { header, data: new Uint8Array(plain) };
	} catch {
		throw new SealedError('Frame failed authentication.');
	}
}
