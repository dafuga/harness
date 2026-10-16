import { expect, test } from 'vitest';
import { HostCommandValidator } from '../../src/validators/HostCommandValidator';
import { sealedText } from '../support/relayActors';
import { acceptPacket, helloPacket, sealedPacket } from '../support/relayPackets';

const deviceId = 'd4'.repeat(20);
const connectionId = 'c5'.repeat(16);
const pairingId = 'e6'.repeat(16);
const ref = 'r-17';
const validator = new HostCommandValidator();

function refused(value: unknown): boolean {
	try {
		validator.command(value);
		return false;
	} catch {
		return true;
	}
}

async function commands(): Promise<Record<string, unknown>[]> {
	const expiresAt = new Date(Date.now() + 60_000).toISOString();
	return [
		{ type: 'packet', deviceId, connectionId, packet: await acceptPacket() },
		{ type: 'packet', deviceId, connectionId, packet: { type: 'reject', reason: 'revoked' } },
		{ type: 'packet', deviceId, connectionId, packet: sealedPacket(3) },
		{ type: 'pairing-open', ref, pairingId, expiresAt },
		{ type: 'pairing-approve', ref, pairingId, deviceId, sealed: sealedText() },
		{ type: 'pairing-deny', ref, pairingId },
		{ type: 'pairing-close', ref, pairingId },
		{ type: 'device-revoke', ref, deviceId },
		{ type: 'device-drop', deviceId, connectionId, code: 4401 }
	];
}

test('HostCommandValidator returns every command of the contract as it was sent', async () => {
	for (const command of await commands()) {
		expect(validator.command(structuredClone(command)), String(command.type)).toEqual(command);
	}
});

test('HostCommandValidator refuses what is not a command', () => {
	const values = [null, undefined, 7, 'packet', [], [{ type: 'pairing-deny', ref, pairingId }], {}];
	for (const value of values) expect(refused(value), JSON.stringify(value)).toBe(true);
	expect(refused({ type: 'ready', hostId: deviceId, devices: [] })).toBe(true);
	expect(refused({ type: 'pairing-request', ref, pairingId })).toBe(true);
	expect(refused({ type: 'constructor', ref })).toBe(true);
});

test('HostCommandValidator refuses a missing or an unknown field', async () => {
	for (const command of await commands()) {
		for (const key of Object.keys(command).filter((name) => name !== 'type')) {
			const rest = Object.fromEntries(Object.entries(command).filter(([name]) => name !== key));
			expect(refused(rest), `${String(command.type)} without ${key}`).toBe(true);
		}
		expect(refused({ ...command, extra: 1 }), `${String(command.type)} with extra`).toBe(true);
	}
});

test('HostCommandValidator refuses ids and refs of another shape', () => {
	expect(refused({ type: 'pairing-deny', ref, pairingId: pairingId.toUpperCase() })).toBe(true);
	expect(refused({ type: 'pairing-deny', ref, pairingId: deviceId })).toBe(true);
	expect(refused({ type: 'pairing-deny', ref: '', pairingId })).toBe(true);
	expect(refused({ type: 'pairing-deny', ref: 'r'.repeat(65), pairingId })).toBe(true);
	expect(refused({ type: 'pairing-deny', ref: 7, pairingId })).toBe(true);
	expect(refused({ type: 'device-revoke', ref, deviceId: connectionId })).toBe(true);
	expect(refused({ type: 'pairing-open', ref, pairingId, expiresAt: 'tomorrow' })).toBe(true);
	expect(refused({ type: 'pairing-open', ref, pairingId, expiresAt: Date.now() })).toBe(true);
	const approve = { type: 'pairing-approve', ref, pairingId, deviceId };
	expect(refused({ ...approve, sealed: 'not base64url!' })).toBe(true);
	expect(refused({ ...approve, sealed: '' })).toBe(true);
});

test('HostCommandValidator lets a host send only what a host may send to a device', async () => {
	const packet = { type: 'packet', deviceId, connectionId };
	expect(refused({ ...packet, packet: await helloPacket(deviceId) })).toBe(true);
	expect(
		refused({ ...packet, packet: { type: 'sealed', counter: -1, more: false, data: 'AAAA' } })
	).toBe(true);
	expect(refused({ ...packet, packet: { type: 'event', value: 1 } })).toBe(true);
	expect(refused({ ...packet, packet: 'sealed' })).toBe(true);
});

test('HostCommandValidator keeps device-drop to application close codes', () => {
	const drop = { type: 'device-drop', deviceId, connectionId };
	for (const code of [4000, 4401, 4999]) expect(refused({ ...drop, code })).toBe(false);
	for (const code of [1000, 1006, 3999, 5000, 4401.5, '4401', null]) {
		expect(refused({ ...drop, code }), String(code)).toBe(true);
	}
});
