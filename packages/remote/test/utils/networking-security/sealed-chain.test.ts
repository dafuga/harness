import { expect, test } from 'vitest';
import { SealedError } from '../../../src/models/networking-security/SealedError';
import { toBase64Url } from '../../../src/utils/networking-security/remoteBytes';
import { sealedChain } from '../../../src/utils/networking-security/sealedChain';
import {
	chainEntryHash,
	sealedChainEntry
} from '../../../src/utils/networking-security/sealedChainEntry';
import {
	sealedDevice,
	sealedDevicePublic
} from '../../../src/utils/networking-security/sealedDevice';
import { newScopeKeys } from '../../../src/utils/networking-security/sealedScopeKeys';
import { account, append, commitmentOf, enroll, sealedAccount } from '../../support/sealedFixture';

test('genesis, enroll, scope, revoke and rotate fold into the expected state', async () => {
	const fixture = await sealedAccount();
	const mac = await enroll(fixture, fixture.phone, 'admin');
	const project = newScopeKeys();
	await append(fixture, mac, {
		type: 'scope',
		commitment: await commitmentOf(project),
		devices: []
	});
	const bot = await enroll(fixture, mac, 'bot', [toBase64Url(project.scopeId)]);
	const accountScope = toBase64Url(fixture.scope.scopeId);
	expect(fixture.state.devices[mac.deviceId]!.scopes).toContain(toBase64Url(project.scopeId));
	expect(fixture.state.devices[bot.deviceId]!.scopes).toEqual([toBase64Url(project.scopeId)]);
	await append(fixture, fixture.phone, { type: 'revoke', device: mac.deviceId });
	expect(fixture.state.devices[mac.deviceId]!.active).toBe(false);
	expect(fixture.state.scopes[accountScope]!.stale).toBe(true);
	await append(fixture, fixture.phone, {
		type: 'rotate',
		commitment: await commitmentOf(newScopeKeys(fixture.scope))
	});
	expect(fixture.state.scopes[accountScope]).toMatchObject({ epoch: 1, stale: false });
	expect(fixture.state.seq).toBe(5);
});

test('a bot or a revoked device cannot sign, and recovery may only enroll', async () => {
	const fixture = await sealedAccount();
	const bot = await enroll(fixture, fixture.phone, 'bot');
	const late = await sealedDevice();
	const enrollLate = { type: 'enroll' as const, device: sealedDevicePublic(late, 'admin', []) };
	await expect(append(fixture, bot, enrollLate)).rejects.toThrow('bot cannot sign enroll');
	fixture.entries.pop();
	await append(fixture, fixture.recovery, enrollLate);
	await expect(
		append(fixture, fixture.recovery, { type: 'revoke', device: bot.deviceId })
	).rejects.toThrow('recovery cannot sign revoke');
	fixture.entries.pop();
	await append(fixture, fixture.phone, { type: 'revoke', device: late.deviceId });
	await expect(append(fixture, late, { type: 'revoke', device: bot.deviceId })).rejects.toThrow(
		'not an active device'
	);
});

test('the server cannot reorder, alter, truncate or fork a pinned chain', async () => {
	const fixture = await sealedAccount();
	await enroll(fixture, fixture.phone, 'admin');
	await enroll(fixture, fixture.phone, 'bot');
	const entries = fixture.entries;
	const pin = { seq: fixture.state.seq, head: fixture.state.head };
	await expect(sealedChain([entries[0]!, entries[2]!, entries[1]!], { account })).rejects.toThrow(
		SealedError
	);
	const altered = { ...entries[1]!, at: 999 };
	await expect(sealedChain([entries[0]!, altered, entries[2]!], { account })).rejects.toThrow(
		'bad signature'
	);
	await expect(sealedChain(entries.slice(0, 2), { account, pin })).rejects.toThrow(
		'older than the pin'
	);
	const fork = [...entries.slice(0, 2)];
	const evil = await sealedDevice();
	fork.push(
		await sealedChainEntry(fixture.phone, {
			seq: 2,
			prev: await chainEntryHash(entries[1]!),
			at: 3,
			by: fixture.phone.deviceId,
			body: { type: 'enroll', device: sealedDevicePublic(evil, 'admin', []) }
		})
	);
	await expect(sealedChain(fork, { account, pin })).rejects.toThrow('forked');
	await expect(sealedChain(entries, { account: 'someone-else' })).rejects.toThrow(
		'another account'
	);
	await expect(sealedChain([], { account })).rejects.toThrow('empty');
});

test('a server-made genesis or second genesis is refused', async () => {
	const fixture = await sealedAccount();
	const intruder = await sealedDevice();
	const second = await sealedChainEntry(intruder, {
		seq: 1,
		prev: await chainEntryHash(fixture.entries[0]!),
		at: 2,
		by: intruder.deviceId,
		body: {
			type: 'genesis',
			account,
			devices: [sealedDevicePublic(intruder, 'admin', [])],
			scopes: []
		}
	});
	await expect(sealedChain([...fixture.entries, second], { account })).rejects.toThrow(SealedError);
	const reused = {
		type: 'enroll' as const,
		device: sealedDevicePublic(fixture.phone, 'admin', [])
	};
	await expect(append(fixture, fixture.phone, reused)).rejects.toThrow('device id reused');
	fixture.entries.pop();
	const skip = await commitmentOf({ ...newScopeKeys(fixture.scope), epoch: 2 });
	await expect(
		append(fixture, fixture.phone, { type: 'rotate', commitment: skip })
	).rejects.toThrow('skips');
});
