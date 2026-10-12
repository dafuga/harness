import { expect, test } from 'vitest';
import { RemoteHostValidator } from '../../src/validators/RemoteHostValidator';
import { DEVICE_ID, hostIdentity, registration } from '../support/remoteFixture';

const validator = new RemoteHostValidator();

/** The public code a refusal carries, or `accepted` when nothing was refused. */
async function verdict(work: () => unknown): Promise<string> {
	try {
		await work();
		return 'accepted';
	} catch (error) {
		return (error as { code?: string }).code ?? 'threw';
	}
}

test('a registration is rebuilt from its four fields with a trimmed name', async () => {
	const host = await hostIdentity();
	const claims = { owner: { id: 'x' }, ownerId: 'x', actor: { id: 'x' }, generation: 9 };
	const body = { ...registration(host, { name: '  Studio Mac \n' }), ...claims };
	expect(await validator.registration(body)).toEqual(registration(host));
	const longest = await validator.registration(registration(host, { name: 'n'.repeat(80) }));
	expect(longest.name).toHaveLength(80);
});

test('a registration whose id is not the hash of its key is refused', async () => {
	const mine = await hostIdentity(),
		other = await hostIdentity();
	const swapped = { hostId: mine.hostId, hostKey: other.hostKey };
	expect(await verdict(() => validator.registration(registration(swapped)))).toBe('invalid-input');
	const flipped = mine.hostId.replace(/.$/, (last) => (last === '0' ? '1' : '0'));
	const near = registration({ hostId: flipped, hostKey: mine.hostKey });
	expect(await verdict(() => validator.registration(near))).toBe('invalid-input');
	const point = Buffer.from(mine.hostKey, 'base64url');
	point[0] = 5;
	const notAPoint = registration(mine, { hostKey: point.toString('base64url') });
	expect(await verdict(() => validator.registration(notAPoint))).toBe('invalid-input');
	expect(await verdict(() => validator.registration(registration(mine)))).toBe('accepted');
});

test('malformed registration fields are refused', async () => {
	const host = await hostIdentity(),
		{ hostId, hostKey } = host;
	const fields: Record<string, unknown>[] = [
		{ hostId: hostId.toUpperCase() },
		{ hostId: hostId.slice(1) },
		{ hostId: `${hostId}\n` },
		{ hostId: [hostId] },
		{ hostKey: hostKey.slice(0, -1) },
		{ hostKey: `${hostKey}A` },
		{ hostKey: `${hostKey}=` },
		{ hostKey: hostKey.replace(/.$/, '+') },
		{ hostKey: null },
		{ credentialHash: 'c'.repeat(63) },
		{ credentialHash: 'c'.repeat(65) },
		{ credentialHash: 'C'.repeat(64) },
		{ credentialHash: 'g'.repeat(64) },
		{ credentialHash: 7 },
		{ name: '' },
		{ name: ' \t\n ' },
		{ name: 'n'.repeat(81) },
		{ name: ['Studio Mac'] },
		{ name: null }
	];
	for (const field of fields) {
		const body = registration(host, field);
		expect([field, await verdict(() => validator.registration(body))]).toEqual([
			field,
			'invalid-input'
		]);
	}
	expect(await verdict(() => validator.registration({}))).toBe('invalid-input');
});

test('host and device ids are forty lowercase hex characters', async () => {
	const { hostId } = await hostIdentity();
	expect(validator.hostId(hostId)).toBe(hostId);
	expect(validator.deviceId(DEVICE_ID)).toBe(DEVICE_ID);
	const bad = [
		'',
		hostId.toUpperCase(),
		hostId.slice(1),
		`${hostId}a`,
		`${hostId}\n`,
		` ${hostId}`,
		'g'.repeat(40),
		7,
		null,
		undefined,
		[hostId]
	];
	for (const value of bad) {
		expect([value, await verdict(() => validator.hostId(value))]).toEqual([value, 'invalid-input']);
		expect(await verdict(() => validator.deviceId(value))).toBe('invalid-input');
	}
});
