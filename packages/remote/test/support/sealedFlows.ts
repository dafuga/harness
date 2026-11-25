import type {
	RawScopeKeys,
	SealedChainEntry,
	SealedChainState,
	SealedDeviceKeys,
	SealedGrant,
	SealedRole
} from '../../src/models/networking-security/Sealed.types';
import { fromBase64Url, toBase64Url } from '../../src/utils/networking-security/remoteBytes';
import { sealedChain } from '../../src/utils/networking-security/sealedChain';
import {
	chainEntryHash,
	sealedChainEntry
} from '../../src/utils/networking-security/sealedChainEntry';
import { sealedDevice, sealedDevicePublic } from '../../src/utils/networking-security/sealedDevice';
import { openSealedGrant, sealedGrant } from '../../src/utils/networking-security/sealedGrant';
import {
	checkEnrollCommit,
	sealedEnrollCommit,
	sealedSas
} from '../../src/utils/networking-security/sealedSas';
import { account } from './sealedFixture';
import type { SealedServer } from './sealedServer';

/** Reads and verifies the chain the way every client does. */
export async function readChain(server: SealedServer): Promise<SealedChainState> {
	return sealedChain(
		server.readChain().map((text) => JSON.parse(text) as SealedChainEntry),
		{ account }
	);
}

/** Signs the next entry against the server's current head and appends it. */
export async function appendEntry(
	server: SealedServer,
	signer: SealedDeviceKeys,
	body: SealedChainEntry['body']
) {
	const entries = server.readChain().map((text) => JSON.parse(text) as SealedChainEntry);
	const last = entries.at(-1);
	const entry = await sealedChainEntry(signer, {
		seq: entries.length,
		prev: last ? await chainEntryHash(last) : '',
		at: entries.length + 1,
		by: signer.deviceId,
		body
	});
	server.appendChain(JSON.stringify(entry));
}

export async function grantAll(
	server: SealedServer,
	raw: RawScopeKeys,
	devices: SealedDeviceKeys[]
) {
	for (const device of devices)
		server.putGrant(
			JSON.stringify(await sealedGrant(account, raw, sealedDevicePublic(device, 'admin', [])))
		);
}

export async function keysFor(
	server: SealedServer,
	device: SealedDeviceKeys,
	scope: string,
	epoch: number
) {
	const chain = await readChain(server);
	const grant = server
		.grantsFor(device.deviceId)
		.map((text) => JSON.parse(text) as SealedGrant)
		.find((item) => item.scope === scope && item.epoch === epoch);
	if (!grant) throw new Error('no grant');
	return openSealedGrant(grant, device, chain);
}

/**
 * The enrollment of a new device through the server: commit, claim, reveal, matching codes, then
 * the approver appends `enroll` and wraps every scope the new device gets.
 */
export async function enrollThroughServer(
	server: SealedServer,
	approver: SealedDeviceKeys,
	role: SealedRole,
	scopes: RawScopeKeys[]
): Promise<{ device: SealedDeviceKeys; codes: [string, string] }> {
	const device = await sealedDevice(),
		requestNonce = crypto.getRandomValues(new Uint8Array(32)),
		approverNonce = crypto.getRandomValues(new Uint8Array(32));
	const commit = await sealedEnrollCommit(device, requestNonce);
	const keys = {
		kemPublic: toBase64Url(device.kemPublic),
		signingPublic: toBase64Url(device.signingPublic)
	};
	server.enrollStep('r1', JSON.stringify({ ...keys, commit }));
	server.enrollStep(
		'r1',
		JSON.stringify({ approver: approver.deviceId, nonce: toBase64Url(approverNonce) })
	);
	server.enrollStep('r1', JSON.stringify({ nonce: toBase64Url(requestNonce) }));
	const request = {
		kemPublic: fromBase64Url(keys.kemPublic),
		signingPublic: fromBase64Url(keys.signingPublic)
	};
	if (!(await checkEnrollCommit(request, requestNonce, commit))) throw new Error('commit mismatch');
	const sas = {
		request,
		requestNonce,
		approverSigningPublic: approver.signingPublic,
		approverNonce
	};
	const codes: [string, string] = [
		await sealedSas(sas),
		await sealedSas({ ...sas, request: device })
	];
	const names = scopes.map((scope) => toBase64Url(scope.scopeId));
	await appendEntry(server, approver, {
		type: 'enroll',
		device: sealedDevicePublic(device, role, names)
	});
	for (const scope of scopes) await grantAll(server, scope, [device]);
	return { device, codes };
}
