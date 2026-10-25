import { expect, test } from 'vitest';
import { TestExpectationService } from '../../../../src/services/verification-evidence/TestExpectationService';
import type { ComponentManifest } from '../../../../src/core/unitTypes';
import unit from '../../../../specification/units/relay.validator.manage-body.json' with { type: 'json' };
import { ManageBodyValidator } from '../../src/validators/ManageBodyValidator';
import { newHost, registration } from '../support/relayActors';

async function ownerInitialized(): Promise<void> {
	const validator = new ManageBodyValidator();
	const body = await registration(await newHost('owner-1'));
	const hostId = String(body.hostId);
	const owner = { owner: { id: 'owner-1' }, hostId };
	expect(validator.owner(owner)).toEqual(owner);
	expect(validator.owner({ ...owner, owner: { id: 'owner-1', admin: true }, extra: 1 })).toEqual(
		owner
	);
	const shortest = { owner: { id: 'o' }, hostId };
	const longest = { owner: { id: 'o'.repeat(200) }, hostId };
	expect(validator.owner(shortest)).toEqual(shortest);
	expect(validator.owner(longest)).toEqual(longest);
	const refused = [
		undefined,
		null,
		7,
		[],
		'owner-1',
		{},
		{ hostId },
		{ owner: null, hostId },
		{ owner: [], hostId },
		{ owner: 'owner-1', hostId },
		{ owner: {}, hostId },
		{ owner: { id: '' }, hostId },
		{ owner: { id: null }, hostId },
		{ owner: { id: 7 }, hostId },
		{ owner: { id: 'o'.repeat(201) }, hostId },
		{ owner: { id: 'owner-1' } },
		{ owner: { id: 'owner-1' }, hostId: null },
		{ owner: { id: 'owner-1' }, hostId: 'abc' },
		{ owner: { id: 'owner-1' }, hostId: hostId.slice(1) },
		{ owner: { id: 'owner-1' }, hostId: `${hostId}0` },
		{ owner: { id: 'owner-1' }, hostId: hostId.toUpperCase() }
	];
	for (const value of refused)
		expect(validator.owner(value), JSON.stringify(value)).toBeUndefined();
}

async function registerInitialized(): Promise<void> {
	const validator = new ManageBodyValidator();
	const body = await registration(await newHost('owner-1'));
	const hash = String(body.credentialHash);
	const hostKey = String(body.hostKey);
	expect(validator.register(body)).toEqual(body);
	expect(validator.register({ ...body, role: 'admin' })).toEqual(body);
	expect(validator.register({ ...body, owner: { id: 'owner-1', admin: true } })).toEqual(body);
	const shortest = { ...body, name: 'n' };
	const longest = { ...body, name: 'n'.repeat(200) };
	expect(validator.register(shortest)).toEqual(shortest);
	expect(validator.register(longest)).toEqual(longest);
	const refused: Record<string, unknown>[] = [
		{ hostKey: undefined },
		{ hostKey: null },
		{ hostKey: 'AAAA' },
		{ hostKey: hostKey.slice(1) },
		{ hostKey: `${hostKey}A` },
		{ hostKey: `${hostKey.slice(0, 86)}+` },
		{ credentialHash: undefined },
		{ credentialHash: null },
		{ credentialHash: hash.slice(1) },
		{ credentialHash: `${hash}0` },
		{ credentialHash: hash.toUpperCase() },
		{ credentialHash: `${hash.slice(0, 63)}g` },
		{ name: undefined },
		{ name: null },
		{ name: '' },
		{ name: 7 },
		{ name: 'n'.repeat(201) },
		{ owner: null },
		{ owner: { id: '' } },
		{ hostId: undefined },
		{ hostId: 'abc' }
	];
	for (const change of refused) {
		expect(validator.register({ ...body, ...change }), JSON.stringify(change)).toBeUndefined();
	}
	expect(validator.register(null)).toBeUndefined();
	expect(validator.register(undefined)).toBeUndefined();
}

async function deviceInitialized(): Promise<void> {
	const validator = new ManageBodyValidator();
	const body = await registration(await newHost('owner-1'));
	const deviceId = 'd4'.repeat(20);
	const call = { owner: { id: 'owner-1' }, hostId: body.hostId, deviceId };
	expect(validator.device(call)).toEqual(call);
	expect(validator.device({ ...call, role: 'device' })).toEqual(call);
	expect(validator.device({ ...call, deviceId: deviceId.slice(2) })).toBeUndefined();
	expect(validator.device({ ...call, deviceId: undefined })).toBeUndefined();
	expect(validator.device({ ...call, owner: {} })).toBeUndefined();
	const refused = [
		{ ...call, deviceId: deviceId.slice(1) },
		{ ...call, deviceId: `${deviceId}0` },
		{ ...call, deviceId: deviceId.toUpperCase() },
		{ ...call, deviceId: `g${deviceId.slice(1)}` },
		{ ...call, deviceId: null },
		{ ...call, deviceId: 7 },
		{ owner: call.owner, hostId: call.hostId },
		{ ...call, owner: null },
		{ ...call, hostId: 'abc' }
	];
	for (const value of refused)
		expect(validator.device(value), JSON.stringify(value)).toBeUndefined();
	expect(validator.device(null)).toBeUndefined();
}

new TestExpectationService().registerCases(
	test,
	unit as ComponentManifest,
	'packages/relay/test/validators/manage-body.test.ts',
	{
		'owner-initialized': ownerInitialized,
		'register-initialized': registerInitialized,
		'device-initialized': deviceInitialized
	}
);
