import { expect, test } from 'vitest';
import { SealedError } from '../../../src/models/networking-security/SealedError';
import {
	fromBase64Url,
	toBase64Url,
	toHex
} from '../../../src/utils/networking-security/remoteBytes';
import { sealedDevicePublic } from '../../../src/utils/networking-security/sealedDevice';
import { openSealedGrant, sealedGrant } from '../../../src/utils/networking-security/sealedGrant';
import {
	openSealedRecord,
	sealedRecord
} from '../../../src/utils/networking-security/sealedRecord';
import {
	newScopeKeys,
	sealedScopeKeys
} from '../../../src/utils/networking-security/sealedScopeKeys';
import { account, enroll, sealedAccount } from '../../support/sealedFixture';

test('a grant opens for its device into keys that read the scope', async () => {
	const fixture = await sealedAccount();
	const mac = await enroll(fixture, fixture.phone, 'admin');
	const grant = await sealedGrant(account, fixture.scope, sealedDevicePublic(mac, 'admin', []));
	expect(fromBase64Url(grant.enc)).toHaveLength(65);
	const keys = await openSealedGrant(grant, mac, fixture.state);
	expect(keys.dataKey.extractable).toBe(false);
	const phoneKeys = await sealedScopeKeys(fixture.scope);
	const envelope = await sealedRecord(
		phoneKeys,
		{ objectId: new Uint8Array(32), revision: 1n },
		{ hi: 1 }
	);
	expect((await openSealedRecord(keys, envelope)).value).toEqual({ hi: 1 });
});

test('a server-chosen key wrapped for a real device is refused by the commitment', async () => {
	const fixture = await sealedAccount();
	const mac = await enroll(fixture, fixture.phone, 'admin');
	const injected = { ...newScopeKeys(), scopeId: fixture.scope.scopeId, epoch: 0 };
	const grant = await sealedGrant(account, injected, sealedDevicePublic(mac, 'admin', []));
	await expect(openSealedGrant(grant, mac, fixture.state)).rejects.toThrow(
		'do not match the chain'
	);
});

test('a grant for another device, account, scope or epoch, or a changed byte, is refused', async () => {
	const fixture = await sealedAccount();
	const mac = await enroll(fixture, fixture.phone, 'admin');
	const bot = await enroll(fixture, fixture.phone, 'bot', []);
	const grant = await sealedGrant(account, fixture.scope, sealedDevicePublic(mac, 'admin', []));
	await expect(openSealedGrant(grant, bot, fixture.state)).rejects.toThrow(
		'another account or device'
	);
	const forBot = await sealedGrant(account, fixture.scope, sealedDevicePublic(bot, 'bot', []));
	await expect(openSealedGrant(forBot, bot, fixture.state)).rejects.toThrow(
		'does not grant this scope'
	);
	await expect(openSealedGrant({ ...grant, epoch: 1 }, mac, fixture.state)).rejects.toThrow(
		'no such scope epoch'
	);
	const relabeled = { ...grant, account: 'actor-2' };
	await expect(
		openSealedGrant(relabeled, mac, { ...fixture.state, account: 'actor-2' })
	).rejects.toThrow('authentication');
	const ct = fromBase64Url(grant.ct);
	ct[3]! ^= 1;
	await expect(
		openSealedGrant({ ...grant, ct: toBase64Url(ct) }, mac, fixture.state)
	).rejects.toThrow(SealedError);
});

test('grant plaintext never appears in the grant and each wrap differs', async () => {
	const fixture = await sealedAccount();
	const device = sealedDevicePublic(fixture.phone, 'admin', []);
	const [a, b] = await Promise.all([1, 2].map(() => sealedGrant(account, fixture.scope, device)));
	expect(a!.enc).not.toBe(b!.enc);
	const wire = JSON.stringify(a);
	expect(wire).not.toContain(toBase64Url(fixture.scope.dataKey));
	expect(wire).not.toContain(toHex(fixture.scope.dataKey));
});
