import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { RemoteHostValidator } from '../../src/validators/networking-security/RemoteHostValidator';
import type { Body } from '../../src/validators/networking-security/RemoteHostValidator.types';

const validator = new RemoteHostValidator();
const LONGEST_NAME = 'x'.repeat(80);

// hostId must be the first 40 hex of SHA-256 over each key's 65 decoded bytes (remoteIdentity).
// The contract's example hostIds do not match their keys, so these are the matching identities.
const STUDIO_ID = '59c67700c789461bd7168ce26888137033c42581';
const OFFICE_ID = '5bcfd4ed19242c21d7028cf27b195f3e00718b20';

const studio: Body = {
	hostId: STUDIO_ID,
	hostKey:
		'BKxH0d3Q1s9VbL2n7MjY4fWcE8tPzR6aGiU5oXkT3yNq0JhSdCe1lBvZ8rFuIA_wmDg4KpOyQ7sEb9TnLx2HcVQ',
	credentialHash: '9c4e0a7b1f5d28e36a0c9b47d2f81e5a3c6b09d4e7f2a18b5c3d6e0f9a2b7c41',
	name: '  Studio Mac mini  ',
	ownerId: 'someone-else'
};

const office: Body = {
	hostId: OFFICE_ID,
	hostKey:
		'BPm3Yx0aT7wQ2kLd9sHeVn5Rb1JgZo8uCwE4iKfMt6AyNqS0XhdLr2pU9VcGk3OjBz7W1-Ee4hMv_Ti8Rq0nYaA',
	credentialHash: 'e0b3f9a6c2d814e7b5a90c3f6d2e18b47a5c0f93d6e2b1a84c7f0d9e35b2a61c',
	name: 'Office Mac Studio'
};

async function rejection(
	run: () => unknown
): Promise<{ name: string; message: string; code: unknown }> {
	let error: unknown;
	try {
		await Promise.resolve(run());
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error & { code?: unknown };
	expect(actual.code).toBe('invalid-input');
	return { name: actual.name, message: actual.message, code: actual.code };
}

test('Registers each host when its id matches its key', async () => {
	const studioOutput = await validator.registration(studio);
	const officeOutput = await validator.registration(office);
	expect(studioOutput).toEqual({
		hostId: STUDIO_ID,
		hostKey: studio.hostKey,
		credentialHash: studio.credentialHash,
		name: 'Studio Mac mini'
	});
	expect(Object.keys(studioOutput).sort()).toEqual(['credentialHash', 'hostId', 'hostKey', 'name']);
	expect(officeOutput.name).toBe('Office Mac Studio');

	recordExampleCases(
		{
			unitId: 'hub.validator.remote-host',
			symbol: 'registration',
			state: 'registers-each-host-when-its-id-matches-its-key',
			evidence: 'examples-cases',
			file: 'registers-each-host-when-its-id-matches-its-key.json'
		},
		[
			{ name: 'registers the studio host and trims its name', input: studio, output: studioOutput },
			{ name: 'registers the office host', input: office, output: officeOutput }
		]
	);
});

test('Rejects a registration whose host id belongs to another key', async () => {
	const swapped = { ...studio, hostId: OFFICE_ID };
	const error = await rejection(() => validator.registration(swapped));
	expect(error.message).toBe('Harness artifact unavailable');

	recordExampleCases(
		{
			unitId: 'hub.validator.remote-host',
			symbol: 'registration',
			state: 'rejects-a-registration-whose-host-id-belongs-to-another-key',
			evidence: 'examples-cases',
			file: 'rejects-a-registration-whose-host-id-belongs-to-another-key.json'
		},
		[{ name: 'rejects the office id paired with the studio key', input: swapped, error }]
	);
});

test('Rejects a registration with an empty or oversized name', async () => {
	const longest = await validator.registration({ ...studio, name: LONGEST_NAME });
	expect(longest.name).toHaveLength(80);
	const blank = await rejection(() => validator.registration({ ...studio, name: '   ' }));
	const tooLong = await rejection(() =>
		validator.registration({ ...studio, name: `${LONGEST_NAME}x` })
	);

	recordExampleCases(
		{
			unitId: 'hub.validator.remote-host',
			symbol: 'registration',
			state: 'rejects-a-registration-with-an-empty-or-oversized-name',
			evidence: 'examples-cases',
			file: 'rejects-a-registration-with-an-empty-or-oversized-name.json'
		},
		[
			{
				name: 'accepts a name of exactly 80 characters',
				input: { hostId: STUDIO_ID, nameLength: 80 },
				output: { nameLength: longest.name.length }
			},
			{ name: 'rejects a name blank after trimming', input: { name: '   ' }, error: blank },
			{ name: 'rejects a name of 81 characters', input: { nameLength: 81 }, error: tooLong }
		]
	);
});

test('Returns well-formed host and device ids unchanged', async () => {
	const deviceInput = '0e5d2b9f71a3c86e4d0b29f5a7c1e38d6b4f0a72';
	const hostId = validator.hostId(OFFICE_ID);
	const deviceId = validator.deviceId(deviceInput);
	expect(hostId).toBe(OFFICE_ID);
	expect(deviceId).toBe(deviceInput);
	const upper = await rejection(() => validator.hostId(OFFICE_ID.toUpperCase()));

	recordExampleCases(
		{
			unitId: 'hub.validator.remote-host',
			symbol: 'hostId',
			state: 'returns-well-formed-host-and-device-ids-unchanged',
			evidence: 'examples-cases',
			file: 'returns-well-formed-host-and-device-ids-unchanged.json'
		},
		[
			{ name: 'returns a lowercase hex host id unchanged', input: OFFICE_ID, output: hostId },
			{
				name: 'returns a lowercase hex device id unchanged (deviceId)',
				input: deviceInput,
				output: deviceId
			},
			{ name: 'rejects an uppercase host id', input: OFFICE_ID.toUpperCase(), error: upper }
		]
	);
});
