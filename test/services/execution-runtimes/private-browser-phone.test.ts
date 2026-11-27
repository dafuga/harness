import { expect, test, vi } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import { VaultDeviceRepository } from '../../../src/repositories/accounts-access/VaultDeviceRepository';
import { PrivateBrowserGateService } from '../../../src/services/execution-runtimes/PrivateBrowserGateService';
import { PrivateBrowserPhoneService } from '../../../src/services/execution-runtimes/PrivateBrowserPhoneService';
import { FakePhone } from '../../support/credential-vault/phone';

const brokerOrigin = 'https://vault.fixture.test';
const submitPath = '/v1/private-browser/submit';
const reviewed = {
	executor: 'mb2-fixture',
	origin: 'https://provider.fixture.test',
	tabId: 'SYNTHETIC-TAB-1',
	field: 'fixture-card-number',
	recipeDigest: 'b'.repeat(64),
	action: 'submit-fixture-card'
};
const fieldValue = 'synthetic-private-canary';

function enrolledPhones(now: () => number) {
	const phone = new FakePhone();
	const wrongPhone = new FakePhone('other-phone');
	const devices = new VaultDeviceRepository(
		[phone, wrongPhone].map(({ deviceId, signingKey }) => ({
			id: deviceId,
			signingKey,
			role: 'approver'
		})),
		brokerOrigin,
		phone.seal,
		now
	);
	return { phone, wrongPhone, devices };
}

async function fixture() {
	const clock = { now: 1_800_000_000_000 };
	const { phone, wrongPhone, devices } = enrolledPhones(() => clock.now);
	const disposeForm = vi.fn(async () => undefined);
	const verifyResult = vi.fn(async () => true);
	const revokeInput = vi.fn(async () => undefined);
	const gate = new PrivateBrowserGateService({ revokeInput, disposeForm, verifyResult });
	await gate.recover();
	const request = await gate.request(phone.deviceId);
	if (!request) throw new Error('Synthetic request was rejected');
	const submitField = vi.fn(async (_scope: unknown, secret: Buffer, _signal: AbortSignal) => {
		expect(secret.equals(Buffer.from(fieldValue))).toBe(true);
	});
	const service = new PrivateBrowserPhoneService({
		gate,
		devices,
		submitField,
		now: () => clock.now
	});
	const offer = () => {
		const response = service.offer(request.requestId, phone.deviceId, reviewed);
		if (!response) throw new Error('Synthetic offer was rejected');
		return response;
	};
	const proof = (
		offered: ReturnType<typeof offer>,
		updates = {},
		device = phone,
		path = submitPath
	) => {
		const { runnerPublicKey, ...scope } = offered;
		const sealed = phone.seal.seal(runnerPublicKey, offered.requestId, Buffer.from(fieldValue));
		const { nonce } = devices.issue(device.deviceId);
		return device.prove(brokerOrigin, path, nonce, { ...scope, sealed, ...updates });
	};
	return {
		offer,
		proof,
		clock,
		wrongPhone,
		service,
		gate,
		request,
		submitField,
		revokeInput,
		disposeForm,
		verifyResult
	};
}

test('accepts one enrolled phone submission, never returns the field and clears plaintext', async () => {
	await measureWorkload(
		'service.execution-runtimes-private-browser-phone',
		'verify-signed-phone-delivery',
		async () => {
			const { offer, proof, service, gate, submitField, verifyResult } = await fixture();
			const offered = offer();
			const signed = proof(offered);
			expect(await service.submit(signed)).toBe(true);
			expect(submitField).toHaveBeenCalledTimes(1);
			const [scope, observed] = submitField.mock.calls[0];
			expect(scope).toEqual(reviewed);
			expect(observed.every((byte) => byte === 0)).toBe(true);
			expect(verifyResult).toHaveBeenCalledTimes(1);
			expect(gate.status()).toBe('ready');
			expect(await service.submit(signed)).toBe(false);
		}
	);
});

test('rejects signed scope changes, another enrolled phone, the wrong route and expired delivery', async () => {
	const { offer, proof, clock, wrongPhone, service, gate, request, submitField } = await fixture();
	const offered = offer();
	for (const changes of [
		{ executor: 'other-executor' },
		{ origin: 'https://different.fixture.test' },
		{ tabId: 'OTHER-TAB' },
		{ field: 'different-field' },
		{ action: 'different-action' },
		{ requestId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' },
		{ recipeDigest: 'c'.repeat(64) },
		{ expiresAt: offered.expiresAt + 1 },
		{ runnerFingerprint: 'a'.repeat(64) }
	]) {
		expect(await service.submit(proof(offered, changes))).toBe(false);
	}
	expect(await service.submit(proof(offered, {}, wrongPhone))).toBe(false);
	expect(await service.submit(proof(offered, {}, undefined, '/different'))).toBe(false);
	clock.now = offered.expiresAt;
	expect(await service.submit(proof(offered))).toBe(false);
	expect(submitField).not.toHaveBeenCalled();
	expect(await gate.cancel(request.requestId)).toBe(true);
});

test('cancelling during delivery aborts and drains the script before disposing the form', async () => {
	const { offer, proof, service, gate, request, submitField, disposeForm } = await fixture();
	const started = Promise.withResolvers<AbortSignal>();
	const ongoing = Promise.withResolvers<void>();
	submitField.mockImplementationOnce(async (_scope, _secret, signal) => {
		started.resolve(signal);
		await ongoing.promise;
	});
	const delivery = service.submit(proof(offer()));
	const signal = await started.promise;
	expect(gate.permitsInput(request.requestId, 'test-iphone')).toBe(false);
	expect(await gate.finish(request.requestId, 'test-iphone')).toBe(false);
	const cancelled = gate.cancel(request.requestId);
	expect(signal.aborted).toBe(true);
	expect(disposeForm).toHaveBeenCalledTimes(1);
	expect(await gate.read(async () => 'unsafe')).toBeUndefined();
	ongoing.resolve();
	expect(await cancelled).toBe(true);
	expect(await delivery).toBe(false);
	expect(disposeForm).toHaveBeenCalledTimes(2);
	expect(gate.status()).toBe('ready');
});
