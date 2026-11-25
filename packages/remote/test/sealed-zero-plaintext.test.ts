import { expect, test } from 'vitest';
import {
	fromBase64Url,
	remoteBytes,
	toBase64Url
} from '../src/utils/networking-security/remoteBytes';
import { sealedDevice, sealedDevicePublic } from '../src/utils/networking-security/sealedDevice';
import {
	openSealedFrame,
	sealedFrame,
	sealedStreamKey
} from '../src/utils/networking-security/sealedFrame';
import { openSealedRecord, sealedRecord } from '../src/utils/networking-security/sealedRecord';
import { newRecoverySecret, sealedRecovery } from '../src/utils/networking-security/sealedRecovery';
import {
	newScopeKeys,
	scopeCommitment,
	sealedObjectId
} from '../src/utils/networking-security/sealedScopeKeys';
import type { ScopeKeys } from '../src/models/networking-security/Sealed.types';
import { expectNoPlaintext } from './support/plaintextCanary';
import { account } from './support/sealedFixture';
import {
	appendEntry,
	enrollThroughServer,
	grantAll,
	keysFor,
	readChain
} from './support/sealedFlows';
import { SealedServer } from './support/sealedServer';
import type { Account, MacSession } from './sealed-zero-plaintext.test.types';

const canary = {
	title: 'Ship sealed sync before Friday canary',
	note: 'Daniel prefers the harbor build canary',
	device: "Daniel's iPhone canary",
	output: 'bun test sealed: 29 passed canary',
	project: 'grok private roadmap canary',
	afterRevoke: 'written after the Mac was revoked canary',
	secretLike: 'sk-canary-0123456789abcdef'
};

async function commitment(raw: ReturnType<typeof newScopeKeys>) {
	return {
		scope: toBase64Url(raw.scopeId),
		epoch: raw.epoch,
		commitment: toBase64Url(await scopeCommitment(raw))
	};
}

async function op(server: SealedServer, keys: ScopeKeys, value: object): Promise<void> {
	const objectId = crypto.getRandomValues(new Uint8Array(32));
	server.postOps(toBase64Url(keys.scopeId), [
		await sealedRecord(keys, { objectId, revision: 0n }, value)
	]);
}

async function readOps(server: SealedServer, keys: ScopeKeys): Promise<unknown[]> {
	const envelopes = server.readOps(toBase64Url(keys.scopeId), 0).map(fromBase64Url);
	const opened = [];
	for (const envelope of envelopes) {
		try {
			opened.push((await openSealedRecord(keys, envelope)).value);
		} catch {
			// Another epoch: a reader with those keys opens it.
		}
	}
	return opened;
}

async function genesisAccount(server: SealedServer): Promise<Account> {
	const phone = await sealedDevice(),
		recovery = await sealedDevice({ extractable: true }),
		accountScope = newScopeKeys();
	const scope = toBase64Url(accountScope.scopeId);
	const devices = [
		sealedDevicePublic(phone, 'admin', [scope]),
		sealedDevicePublic(recovery, 'recovery', [scope])
	];
	const scopes = [await commitment(accountScope)];
	await appendEntry(server, phone, { type: 'genesis', account, devices, scopes });
	await grantAll(server, accountScope, [phone, recovery]);
	server.putObject(
		scope,
		'recovery',
		fromBase64Url(await sealedRecovery(newRecoverySecret(), recovery))
	);
	const phoneKeys = await keysFor(server, phone, scope, 0);
	const nameId = await sealedObjectId(phoneKeys, 'device', phone.deviceId);
	const name = await sealedRecord(
		phoneKeys,
		{ objectId: nameId, revision: 1n },
		{ name: canary.device }
	);
	server.putObject(scope, toBase64Url(nameId), name);
	return { phone, recovery, accountScope, scope, phoneKeys };
}

async function macSyncsAndStreams(server: SealedServer, account: Account): Promise<MacSession> {
	const { device: mac, codes } = await enrollThroughServer(server, account.phone, 'admin', [
		account.accountScope
	]);
	expect(codes[0]).toBe(codes[1]);
	const macKeys = await keysFor(server, mac, account.scope, 0);
	const item = { kind: 'item', title: canary.title, status: 'in progress' };
	await op(server, macKeys, item);
	await op(server, macKeys, { kind: 'note', text: canary.note, secret: canary.secretLike });
	expect(await readOps(server, account.phoneKeys)).toContainEqual(item);
	const streamId = crypto.getRandomValues(new Uint8Array(16));
	const data = remoteBytes(canary.output);
	const frame = await sealedFrame(macKeys, await sealedStreamKey(macKeys, streamId), {
		streamId,
		counter: 0n,
		data
	});
	const relayed = fromBase64Url(server.relayFrame(frame));
	const phoneStream = await sealedStreamKey(account.phoneKeys, streamId);
	const shown = await openSealedFrame(account.phoneKeys, phoneStream, relayed);
	expect(new TextDecoder().decode(shown.data)).toBe(canary.output);
	return { mac, macKeys };
}

async function botReadsOnlyItsProject(server: SealedServer, account: Account) {
	const project = newScopeKeys();
	const projectScope = toBase64Url(project.scopeId);
	await appendEntry(server, account.phone, {
		type: 'scope',
		commitment: await commitment(project),
		devices: []
	});
	await grantAll(server, project, [account.phone]);
	const { device: bot } = await enrollThroughServer(server, account.phone, 'bot', [project]);
	await op(server, await keysFor(server, account.phone, projectScope, 0), {
		kind: 'item',
		title: canary.project
	});
	const botKeys = await keysFor(server, bot, projectScope, 0);
	expect(await readOps(server, botKeys)).toEqual([{ kind: 'item', title: canary.project }]);
	await expect(keysFor(server, bot, account.scope, 0)).rejects.toThrow('no grant');
}

async function revokedMacMissesNewWrites(server: SealedServer, account: Account, mac: MacSession) {
	await appendEntry(server, account.phone, { type: 'revoke', device: mac.mac.deviceId });
	expect((await readChain(server)).scopes[account.scope]!.stale).toBe(true);
	const rotated = newScopeKeys(account.accountScope);
	await appendEntry(server, account.phone, {
		type: 'rotate',
		commitment: await commitment(rotated)
	});
	await grantAll(server, rotated, [account.phone, account.recovery]);
	const phoneNext = await keysFor(server, account.phone, account.scope, 1);
	await op(server, phoneNext, { kind: 'note', text: canary.afterRevoke });
	expect(await readOps(server, phoneNext)).toEqual([{ kind: 'note', text: canary.afterRevoke }]);
	expect(JSON.stringify(await readOps(server, mac.macKeys))).not.toContain(canary.afterRevoke);
	await expect(keysFor(server, mac.mac, account.scope, 1)).rejects.toThrow();
}

test('Cloudflare stores and relays only ciphertext through a full account lifecycle', async () => {
	const server = new SealedServer();
	const account = await genesisAccount(server);
	const mac = await macSyncsAndStreams(server, account);
	await botReadsOnlyItsProject(server, account);
	await revokedMacMissesNewWrites(server, account, mac);
	const stored = server.captured();
	const decoded = stored.filter((text) => /^[A-Za-z0-9_-]+$/.test(text)).map(fromBase64Url);
	expectNoPlaintext([...stored, ...decoded], Object.values(canary));
	expect(server.requests.length).toBeGreaterThan(40);
});
