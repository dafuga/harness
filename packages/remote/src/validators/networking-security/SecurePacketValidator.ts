import { remoteLimits } from '../../models/networking-security/Remote.types';
import { SecureFailure } from '../../models/networking-security/RemoteSecure.types';
import type { SecurePacket } from '../../models/networking-security/RemoteSecure.types';
import { remotePatterns } from '../../utils/networking-security/remoteIdentity';

type Check = (value: unknown) => boolean;
const matches =
	(pattern: RegExp): Check =>
	(value) =>
		typeof value === 'string' && pattern.test(value);
const counter: Check = (value) => Number.isSafeInteger(value) && (value as number) >= 0;
const version: Check = (value) => value === 1;
/** base64url of at most one chunk plus its tag, and at least the tag of an empty chunk. */
const maxData = Math.ceil(((remoteLimits.chunkBytes + 16) * 4) / 3) + 4;
const data: Check = (value) =>
	typeof value === 'string' &&
	value.length >= 22 &&
	value.length <= maxData &&
	/^[A-Za-z0-9_-]+$/.test(value);
const reasons = ['revoked', 'unknown-device', 'version', 'busy'];

/** Every field of every packet, beside `type`. A packet with any other field is refused. */
const shapes: Record<string, Record<string, Check>> = {
	hello: {
		version,
		deviceId: matches(remotePatterns.deviceId),
		ephemeralKey: matches(remotePatterns.key),
		nonce: matches(remotePatterns.nonce)
	},
	accept: {
		version,
		ephemeralKey: matches(remotePatterns.key),
		nonce: matches(remotePatterns.nonce),
		generation: counter
	},
	reject: { reason: (value) => reasons.includes(value as string) },
	sealed: { counter, more: (value) => typeof value === 'boolean', data }
};

function shapeOf(item: Record<string, unknown> | null): Record<string, Check> | null {
	const type = item?.type;
	return typeof type === 'string' && Object.hasOwn(shapes, type) ? shapes[type] : null;
}

/** What a relay forwards and what a secure channel accepts. Failures are never answered. */
export class SecurePacketValidator {
	packet(value: unknown): SecurePacket {
		const item =
			value && typeof value === 'object' && !Array.isArray(value)
				? (value as Record<string, unknown>)
				: null;
		const shape = shapeOf(item);
		if (!item || !shape) throw new SecureFailure('packet');
		const names = Object.keys(shape);
		const exact = Object.keys(item).length === names.length + 1;
		if (!exact || !names.every((name) => shape[name](item[name])))
			throw new SecureFailure('packet');
		return item as unknown as SecurePacket;
	}
	/** One text frame. Its length is checked before anything is parsed. */
	text(text: string): SecurePacket {
		if (text.length > remoteLimits.frameBytes) throw new SecureFailure('size');
		let value: unknown;
		try {
			value = JSON.parse(text);
		} catch {
			throw new SecureFailure('packet');
		}
		return this.packet(value);
	}
}
