import { beforeAll, expect, test } from 'vitest';
import { ManageBodyValidator } from '../../src/validators/ManageBodyValidator';
import { newHost, registration } from '../support/relayActors';

const validator = new ManageBodyValidator();
const deviceId = 'd4'.repeat(20);
let body: Record<string, unknown>;

beforeAll(async () => {
	body = await registration(await newHost('owner-1'));
});

test('ManageBodyValidator reads the owner and the host of every call', () => {
	const owner = { owner: { id: 'owner-1' }, hostId: body.hostId };
	expect(validator.owner(owner)).toEqual(owner);
	expect(validator.owner({ ...owner, owner: { id: 'owner-1', admin: true }, extra: 1 })).toEqual(
		owner
	);
});

test('ManageBodyValidator refuses a call without a usable owner or host', () => {
	const hostId = body.hostId;
	const refused = [
		null,
		[],
		'owner-1',
		{},
		{ hostId },
		{ owner: 'owner-1', hostId },
		{ owner: {}, hostId },
		{ owner: { id: '' }, hostId },
		{ owner: { id: 7 }, hostId },
		{ owner: { id: 'o'.repeat(201) }, hostId },
		{ owner: { id: 'owner-1' } },
		{ owner: { id: 'owner-1' }, hostId: 'abc' },
		{ owner: { id: 'owner-1' }, hostId: String(hostId).toUpperCase() }
	];
	for (const value of refused)
		expect(validator.owner(value), JSON.stringify(value)).toBeUndefined();
});

test('ManageBodyValidator reads a registration', () => {
	expect(validator.register(body)).toEqual(body);
	expect(validator.register({ ...body, role: 'admin' })).toEqual(body);
});

test('ManageBodyValidator refuses a registration with a malformed field', () => {
	const hash = String(body.credentialHash);
	const refused: Record<string, unknown>[] = [
		{ hostKey: undefined },
		{ hostKey: 'AAAA' },
		{ hostKey: `${String(body.hostKey)}A` },
		{ credentialHash: undefined },
		{ credentialHash: hash.slice(1) },
		{ credentialHash: hash.toUpperCase() },
		{ credentialHash: `${hash.slice(0, 63)}g` },
		{ name: undefined },
		{ name: '' },
		{ name: 7 },
		{ name: 'n'.repeat(201) },
		{ owner: { id: '' } },
		{ hostId: 'abc' }
	];
	for (const change of refused) {
		expect(validator.register({ ...body, ...change }), JSON.stringify(change)).toBeUndefined();
	}
});

test('ManageBodyValidator reads the device of a revocation', () => {
	const call = { owner: { id: 'owner-1' }, hostId: body.hostId, deviceId };
	expect(validator.device(call)).toEqual(call);
	expect(validator.device({ ...call, deviceId: deviceId.slice(2) })).toBeUndefined();
	expect(validator.device({ ...call, deviceId: undefined })).toBeUndefined();
	expect(validator.device({ ...call, owner: {} })).toBeUndefined();
});
