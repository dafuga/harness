import { expect, test } from 'vitest';
import { VaultSealAdapter } from '../../../src/adapters/accounts-access/VaultSealAdapter';
import { VaultDeviceRepository } from '../../../src/repositories/accounts-access/VaultDeviceRepository';
import { FakePhone } from '../../support/credential-vault/phone';

const origin = 'https://vault.example.test';
const queuePath = '/v1/device/requests';

function setup(role: 'approver' | 'recovery' = 'approver') {
	let clock = 1_000_000;
	const phone = new FakePhone();
	const devices = new VaultDeviceRepository(
		[{ id: phone.deviceId, role, signingKey: phone.signingKey }],
		origin,
		new VaultSealAdapter(),
		() => clock
	);
	return { phone, devices, advance: (ms: number) => (clock += ms) };
}

test('a challenge answers exactly one signed proof', () => {
	const { phone, devices } = setup();
	const { nonce } = devices.issue(phone.deviceId);
	const proof = phone.prove(origin, queuePath, nonce);
	expect(() => devices.authenticate(queuePath, proof)).not.toThrow();
	expect(() => devices.authenticate(queuePath, proof)).toThrow('invalid or expired');
});

test('expired challenges, other paths and other origins are refused', () => {
	const { phone, devices, advance } = setup();
	const late = devices.issue(phone.deviceId).nonce;
	advance(30_000);
	expect(() => devices.authenticate(queuePath, phone.prove(origin, queuePath, late))).toThrow();
	const path = devices.issue(phone.deviceId).nonce;
	expect(() =>
		devices.authenticate(queuePath, phone.prove(origin, '/v1/device/decision', path))
	).toThrow();
	const other = devices.issue(phone.deviceId).nonce;
	expect(() =>
		devices.authenticate(queuePath, phone.prove('https://evil.example.test', queuePath, other))
	).toThrow();
});

test('unknown and recovery devices cannot get approval challenges', () => {
	expect(() => setup().devices.issue('stranger')).toThrow('not enrolled');
	const recovery = setup('recovery');
	expect(() => recovery.devices.issue(recovery.phone.deviceId)).toThrow('does not allow');
});
