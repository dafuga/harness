import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { RelayReplyValidator } from '../../src/validators/networking-security/RelayReplyValidator';
import type { Fields } from '../../src/validators/networking-security/RelayReplyValidator.types';

const unitId = 'hub.validator.relay-reply';
const hostA = '3e9a71c04d2b58f6a1c7e90d4b3f20a8c5d61e7f';
const hostB = 'b72f0d9e4a1c86f35e20d7b9a4c1f08e6d3a52b9';
const validator = new RelayReplyValidator();

function failureOf(run: () => unknown): { message: string; code: unknown } {
	try {
		run();
	} catch (caught) {
		const error = caught as Error & { code?: unknown };
		return { message: error.message, code: error.code };
	}
	throw new Error('expected the relay reply to be rejected');
}

const registeredReply: Fields = {
	hostId: hostA,
	generation: 2,
	registeredAt: '2026-11-10T08:15:00.000Z',
	relayNote: 'not part of the contract'
};

const registeredExpected = {
	hostId: hostA,
	generation: 2,
	registeredAt: '2026-11-10T08:15:00.000Z'
};

const onlineDevice = {
	deviceId: '5d0c8e2f71a94b36c0e8d52f19a7b4c3e6f10d28',
	online: true,
	createdAt: '2026-11-10T09:02:31.744Z',
	lastSeenAt: '2026-11-13T21:06:44.207Z',
	address: 'dropped'
};

const offlineDevice = {
	deviceId: 'e18a6c03d7f2b94e5a0c83d16f7b29e4a05c1d6b',
	online: false,
	createdAt: '2026-11-11T12:30:05.090Z',
	lastSeenAt: null
};

const summaryReply: Fields = {
	hostId: hostA,
	name: 'Studio Mac',
	online: true,
	generation: 2,
	registeredAt: '2026-11-10T08:15:00.000Z',
	devices: [onlineDevice, offlineDevice],
	relayNote: 'not part of the contract'
};

const summaryExpected = {
	hostId: hostA,
	name: 'Studio Mac',
	online: true,
	generation: 2,
	registeredAt: '2026-11-10T08:15:00.000Z',
	devices: [
		{
			deviceId: onlineDevice.deviceId,
			online: true,
			createdAt: onlineDevice.createdAt,
			lastSeenAt: onlineDevice.lastSeenAt
		},
		offlineDevice
	]
};

const emptySummaryReply: Fields = {
	hostId: hostB,
	name: 'Build Server',
	online: false,
	generation: 1,
	registeredAt: '2026-11-02T17:42:09.518Z',
	devices: []
};

test('Rebuilds a registration and rejects another host', () => {
	const output = validator.registered(registeredReply, hostA);
	expect(output).toEqual(registeredExpected);
	const rejected = failureOf(() => validator.registered(registeredReply, hostB));
	expect(rejected.code).toBe('unavailable');

	recordExampleCases(
		{
			unitId,
			symbol: 'registered',
			state: 'rebuilds-a-registration-and-rejects-another-host',
			evidence: 'examples-cases',
			file: 'rebuilds-a-registration-and-rejects-another-host.json'
		},
		[
			{
				name: 'rebuilds the registration for the requested host',
				input: { reply: registeredReply, hostId: hostA },
				output
			},
			{
				name: 'rejects a reply for another host',
				input: { reply: registeredReply, hostId: hostB },
				error: rejected
			}
		]
	);
});

test('Rebuilds a host summary and drops unnamed fields', () => {
	const output = validator.summary(summaryReply, hostA);
	expect(output).toEqual(summaryExpected);
	const emptyOutput = validator.summary(emptySummaryReply, hostB);
	expect(emptyOutput.devices).toEqual([]);
	const rejected = failureOf(() => validator.summary({ ...summaryReply, devices: 'none' }, hostA));
	expect(rejected.code).toBe('unavailable');

	recordExampleCases(
		{
			unitId,
			symbol: 'summary',
			state: 'rebuilds-a-host-summary-and-drops-unnamed-fields',
			evidence: 'examples-cases',
			file: 'rebuilds-a-host-summary-and-drops-unnamed-fields.json'
		},
		[
			{
				name: 'rebuilds a summary with two devices',
				input: { reply: summaryReply, hostId: hostA },
				output
			},
			{
				name: 'rebuilds an empty summary with no devices',
				input: { reply: emptySummaryReply, hostId: hostB },
				output: emptyOutput
			},
			{
				name: 'rejects a reply whose devices is not an array',
				input: { reply: { ...summaryReply, devices: 'none' }, hostId: hostA },
				error: rejected
			}
		]
	);
});

test('Accepts only an ok reply as the acknowledgement', () => {
	const output = validator.done({ ok: true, relayNote: 'not part of the contract' });
	expect(output).toEqual({ ok: true });
	const rejected = failureOf(() => validator.done({ ok: 'true' }));
	expect(rejected.code).toBe('unavailable');

	recordExampleCases(
		{
			unitId,
			symbol: 'done',
			state: 'accepts-only-an-ok-reply-as-the-acknowledgement',
			evidence: 'examples-cases',
			file: 'accepts-only-an-ok-reply-as-the-acknowledgement.json'
		},
		[
			{
				name: 'returns a fixed acknowledgement for ok true',
				input: { ok: true, relayNote: 'not part of the contract' },
				output
			},
			{
				name: 'rejects a reply whose ok is the string true',
				input: { ok: 'true' },
				error: rejected
			}
		]
	);
});
