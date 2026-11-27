// @harness-uid u_ve3glysnyy
import { fromBase64Url, toBase64Url } from '../../../../../remote/src/index';

/** Bounds of the account object. Everything it forwards is ciphertext it never opens. */
export const syncLimits = {
	/** One sealed stream frame, header and tag included. */
	frameBytes: 256 * 1024,
	/** One subscribe message. */
	textBytes: 4 * 1024,
	scopesPerSocket: 64,
	/** Frames kept for a reconnecting viewer, by count and by age. */
	ringFrames: 64,
	ringMs: 120_000,
	/** Sign-in requests waiting for approval, and how long one waits. */
	openEnrollments: 16,
	enrollmentMs: 10 * 60_000,
	enrollmentSteps: 8,
	stepBytes: 4 * 1024
} as const;

/** `0x02 ‖ scope 16 ‖ epoch u32 ‖ stream 16 ‖ counter u64 ‖ tag 16`: the shortest valid frame. */
const frameHeader = 1 + 16 + 4 + 16 + 8;
const frameType = 2;

/** The scope id in the clear header of a stream frame, or null when the bytes are no frame. */
export function frameScope(frame: Uint8Array): string | null {
	if (frame.length < frameHeader + 16 || frame[0] !== frameType) return null;
	return toBase64Url(frame.slice(1, 17));
}

/** A scope id as the API spells it: 16 bytes, base64url. */
export function isScopeId(value: string): boolean {
	if (!/^[A-Za-z0-9_-]{22}$/.test(value)) return false;
	try {
		return fromBase64Url(value).length === 16;
	} catch {
		return false;
	}
}

/** The ring number in front of a frame sent to a viewer: u64, big-endian. */
export function ringPrefix(ring: number): Uint8Array {
	const bytes = new Uint8Array(8);
	new DataView(bytes.buffer).setBigUint64(0, BigInt(ring));
	return bytes;
}

export function numbered(ring: number, frame: Uint8Array): Uint8Array {
	const bytes = new Uint8Array(8 + frame.length);
	bytes.set(ringPrefix(ring));
	bytes.set(frame, 8);
	return bytes;
}
