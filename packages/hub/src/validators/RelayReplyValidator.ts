import type {
	RelayRegistered,
	RemoteHostSummary
} from '../../../remote/src/models/RemoteRelay.types';
import { hubFail } from '../utils/hubJson';

type Fields = Record<string, unknown>;
type Device = RemoteHostSummary['devices'][number];

function unavailable(): never {
	return hubFail('unavailable');
}

function fields(value: unknown): Fields {
	const plain = typeof value === 'object' && value !== null && !Array.isArray(value);
	return plain ? (value as Fields) : unavailable();
}

function text(value: unknown): string {
	return typeof value === 'string' && value.length > 0 ? value : unavailable();
}

function flag(value: unknown): boolean {
	return typeof value === 'boolean' ? value : unavailable();
}

function count(value: unknown): number {
	const whole = typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
	return whole ? (value as number) : unavailable();
}

function device(value: unknown): Device {
	const entry = fields(value);
	return {
		deviceId: text(entry.deviceId),
		online: flag(entry.online),
		createdAt: text(entry.createdAt),
		lastSeenAt: entry.lastSeenAt === null ? null : text(entry.lastSeenAt)
	};
}

/**
 * What the relay answered, rebuilt field by field: a field the contract does not name never
 * leaves the hub, and an answer of another shape or for another host is `unavailable`.
 */
export class RelayReplyValidator {
	registered(value: unknown, hostId: string): RelayRegistered {
		const reply = fields(value);
		if (reply.hostId !== hostId) return unavailable();
		return { hostId, generation: count(reply.generation), registeredAt: text(reply.registeredAt) };
	}

	summary(value: unknown, hostId: string): RemoteHostSummary {
		const reply = fields(value);
		if (reply.hostId !== hostId || !Array.isArray(reply.devices)) return unavailable();
		return {
			hostId,
			name: text(reply.name),
			online: flag(reply.online),
			generation: count(reply.generation),
			registeredAt: text(reply.registeredAt),
			devices: reply.devices.map(device)
		};
	}

	done(value: unknown): { ok: true } {
		return fields(value).ok === true ? { ok: true } : unavailable();
	}
}
