import { expect, test } from 'vitest';
import { RelayReplyValidator } from '../../src/validators/RelayReplyValidator';
import { CREDENTIAL_HASH, DEVICE_ID } from '../support/remoteFixture';
import { REGISTERED_AT } from '../support/remoteHostsFake';

const validator = new RelayReplyValidator();
const hostId = 'a1'.repeat(20);
const privateFields = { owner: { id: 'google:fixture-one' }, credentialHash: CREDENTIAL_HASH };
const device = { deviceId: DEVICE_ID, online: true, createdAt: REGISTERED_AT, lastSeenAt: null };
const summary = {
	hostId,
	name: 'Studio Mac',
	online: true,
	generation: 3,
	registeredAt: REGISTERED_AT,
	devices: [device, { ...device, online: false, lastSeenAt: REGISTERED_AT }]
};

function verdict(work: () => unknown): string {
	try {
		work();
		return 'accepted';
	} catch (error) {
		return (error as { code?: string }).code ?? 'threw';
	}
}

test('a registration reply is rebuilt from its three fields', () => {
	const reply = { hostId, generation: 2, registeredAt: REGISTERED_AT, ...privateFields };
	expect(validator.registered(reply, hostId)).toEqual({
		hostId,
		generation: 2,
		registeredAt: REGISTERED_AT
	});
});

test('a summary is rebuilt field by field, so private relay fields never leave the hub', () => {
	const devices = summary.devices.map((entry) => ({ ...entry, ...privateFields }));
	const reply = { ...summary, ...privateFields, hostKey: 'B'.repeat(87), devices };
	expect(validator.summary(reply, hostId)).toEqual(summary);
	expect(validator.summary({ ...summary, devices: [] }, hostId).devices).toEqual([]);
});

test('an acknowledgement is exactly ok', () => {
	expect(validator.done({ ok: true, ...privateFields })).toEqual({ ok: true });
	for (const value of [{ ok: false }, { ok: 'true' }, {}, null, [], 'ok', true])
		expect([value, verdict(() => validator.done(value))]).toEqual([value, 'unavailable']);
});

test('a registration reply of another shape or for another host is unavailable', () => {
	const good = { hostId, generation: 1, registeredAt: REGISTERED_AT };
	const bad: unknown[] = [
		{ ...good, hostId: 'b2'.repeat(20) },
		{ ...good, generation: '1' },
		{ ...good, generation: 1.5 },
		{ ...good, generation: -1 },
		{ ...good, registeredAt: 1760259600000 },
		{ ...good, registeredAt: '' },
		{ hostId },
		null,
		[good],
		'registered'
	];
	for (const value of bad)
		expect([value, verdict(() => validator.registered(value, hostId))]).toEqual([
			value,
			'unavailable'
		]);
});

test('a summary of another shape or for another host is unavailable', () => {
	const bad: unknown[] = [
		{ ...summary, hostId: 'b2'.repeat(20) },
		{ ...summary, name: 7 },
		{ ...summary, online: 'yes' },
		{ ...summary, generation: null },
		{ ...summary, registeredAt: undefined },
		{ ...summary, devices: undefined },
		{ ...summary, devices: { 0: device } },
		{ ...summary, devices: [null] },
		{ ...summary, devices: [{ ...device, deviceId: 7 }] },
		{ ...summary, devices: [{ ...device, online: 1 }] },
		{ ...summary, devices: [{ ...device, createdAt: null }] },
		{ ...summary, devices: [{ ...device, lastSeenAt: 0 }] },
		{ ...summary, devices: [{ ...device, lastSeenAt: undefined }] },
		null,
		[summary]
	];
	for (const value of bad)
		expect([value, verdict(() => validator.summary(value, hostId))]).toEqual([
			value,
			'unavailable'
		]);
});
