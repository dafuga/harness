import {
	SecurePacketValidator,
	remoteLimits,
	remotePatterns
} from '../../../../../remote/src/index';
import type { RelayHostFrame } from '../../../../../remote/src/index';

type Fields = Record<string, unknown>;

const packets = new SecurePacketValidator();

/** A device packet plus its address: a little more than one device frame. */
const bound = remoteLimits.frameBytes + 4096;

const matches = (value: unknown, pattern: RegExp) =>
	typeof value === 'string' && pattern.test(value);

const device = (frame: Fields) => matches(frame.deviceId, remotePatterns.deviceId);

const connection = (frame: Fields) =>
	device(frame) && matches(frame.connectionId, remotePatterns.connectionId);

const pairing = (frame: Fields) =>
	matches(frame.pairingId, remotePatterns.pairingId) &&
	matches(frame.ephemeralKey, remotePatterns.key) &&
	matches(frame.sealed, remotePatterns.sealed) &&
	matches(frame.challenge, remotePatterns.challenge);

const checks: Record<string, (frame: Fields) => boolean> = {
	ready: (frame) => matches(frame.hostId, remotePatterns.hostId) && Array.isArray(frame.devices),
	'device-open': connection,
	'device-close': connection,
	packet: (frame) => connection(frame) && Boolean(packets.packet(frame.packet)),
	'pairing-request': pairing,
	'device-revoked': device,
	ack: (frame) => typeof frame.ref === 'string' && typeof frame.ok === 'boolean'
};

/** A frame of the relay to this host, or null. Nothing malformed goes any further. */
export function relayFrame(text: string): RelayHostFrame | null {
	if (text.length > bound) return null;
	try {
		const frame = (JSON.parse(text) ?? {}) as Fields,
			type = typeof frame.type === 'string' ? frame.type : '';
		const known = Object.hasOwn(checks, type) && checks[type](frame);
		return known ? (frame as unknown as RelayHostFrame) : null;
	} catch {
		return null;
	}
}
