import type { Check } from './HostCommandValidator.types';
import { remotePatterns, SecurePacketValidator } from '../../../../remote/src/index';
import type { RelayHostCommand } from '../../../../remote/src/index';
import { isRecord } from '../../utils/development-tooling/isRecord';
import { matchesPattern } from '../../utils/development-tooling/matchesPattern';

const packets = new SecurePacketValidator();
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const text =
	(pattern: RegExp): Check =>
	(value) =>
		matchesPattern(value, pattern);
const deviceId = text(remotePatterns.deviceId);
const connectionId = text(remotePatterns.connectionId);
const pairingId = text(remotePatterns.pairingId);
/** Chosen by the host and echoed in the `ack`: any short text. */
const ref: Check = (value) => typeof value === 'string' && value.length > 0 && value.length <= 64;
const instant: Check = (value) =>
	matchesPattern(value, instantPattern) && Number.isFinite(Date.parse(value));
/** A host closes a connection of a device with a code of the application range only. */
const closeCode: Check = (value) =>
	typeof value === 'number' && Number.isInteger(value) && value >= 4000 && value <= 4999;
/** What a host may send to a device: `accept`, `reject` or `sealed`, exactly as the contract. */
const hostPacket: Check = (value) => {
	try {
		return packets.packet(value).type !== 'hello';
	} catch {
		return false;
	}
};

/** Every field of every command, beside `type`. A command with any other field is refused. */
const shapes: Record<string, Record<string, Check>> = {
	packet: { deviceId, connectionId, packet: hostPacket },
	'pairing-open': { ref, pairingId, expiresAt: instant },
	'pairing-approve': { ref, pairingId, deviceId, sealed: text(remotePatterns.sealed) },
	'pairing-deny': { ref, pairingId },
	'pairing-close': { ref, pairingId },
	'device-revoke': { ref, deviceId },
	'device-drop': { deviceId, connectionId, code: closeCode }
};
/**
 * Fields a command may also carry. An approval without its `challenge` is still a command, so
 * that it is answered with a refusal instead of ending the socket.
 */
const optional: Record<string, Record<string, Check>> = {
	'pairing-approve': { challenge: text(remotePatterns.challenge) }
};

export class HostCommandValidator {
	/** Returns the command, or throws when it is not exactly one of the contract. */
	command(value: unknown): RelayHostCommand {
		const shape = shapeOf(value);
		if (!isRecord(value) || !shape) throw new Error('Not a host command.');
		const names = Object.keys(shape);
		const extra = optional[String(value.type)] ?? {};
		const present = Object.keys(extra).filter((name) => name in value);
		const exact = Object.keys(value).length === names.length + 1 + present.length;
		const valid = names.every((name) => shape[name](value[name]));
		if (!exact || !valid || !present.every((name) => extra[name](value[name]))) {
			throw new Error('Malformed host command.');
		}
		return value as unknown as RelayHostCommand;
	}
}

function shapeOf(value: unknown): Record<string, Check> | undefined {
	const type = isRecord(value) ? value.type : undefined;
	return typeof type === 'string' && Object.hasOwn(shapes, type) ? shapes[type] : undefined;
}
