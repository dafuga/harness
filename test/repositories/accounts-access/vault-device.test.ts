import { expect, test } from 'vitest';
import { VaultSealAdapter } from '../../../src/adapters/accounts-access/VaultSealAdapter';
import { VaultDeviceRepository } from '../../../src/repositories/accounts-access/VaultDeviceRepository';
import { measureWorkload } from '../../support/measureWorkload';
import { FakePhone, randomNonce } from '../../support/credential-vault/phone';

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

test('a signed challenge start is short-lived, single-use and scoped to its route', async () => {
	await measureWorkload('repository.accounts-access-vault-device', 'issue-scoped-challenge', () => {
		const { phone, devices, advance } = setup();
		const requestPath = '/v1/private-browser/challenge';
		const scope = { requestPath, responsePath: queuePath, expiresAt: 1_020_000 };
		const proof = phone.prove(origin, requestPath, randomNonce());
		const { nonce } = devices.issueSigned(proof, scope);
		expect(() => devices.issueSigned(proof, scope)).toThrow('invalid or expired');
		const unrelated = '/v1/private-browser/submit';
		expect(() => devices.authenticate(unrelated, phone.prove(origin, unrelated, nonce))).toThrow(
			'invalid or expired'
		);
		const fresh = phone.prove(origin, requestPath, randomNonce());
		advance(20_000);
		expect(() => devices.issueSigned(fresh, scope)).toThrow('invalid or expired');
	});
});

test('unknown and recovery devices cannot get approval challenges', () => {
	expect(() => setup().devices.issue('stranger')).toThrow('not enrolled');
	const recovery = setup('recovery');
	expect(() => recovery.devices.issue(recovery.phone.deviceId)).toThrow('does not allow');
});
