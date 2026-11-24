import type { Call } from './hubRelayFixture.types';
import { build } from 'esbuild';
import { expect } from 'vitest';
import { command, type TestHost } from '../../../relay/test/support/relayActors';
import type { RelaySocket } from '../../../relay/test/support/relaySocket';
import { relayFrame } from '../../../desktop/src/services/relay-link-service/relayFrame';
import { fileURLToPath } from 'node:url';
import { relayBinding, startRelay } from '../../../relay/test/support/relayFixture';

import {
	HostPairingService,
	pairingEnvelope,
	pkceChallenge,
	randomCredential,
	randomId,
	remoteIdentity,
	remoteKeys,
	sealPairing,
	sharedSecret,
	toBase64Url,
	type RemoteGrant,
	type RemoteKeyPair
} from '../../../remote/src/index';

const entry = fileURLToPath(new URL('./hubRemoteWorker.ts', import.meta.url));
/** What the hub under test is configured to tell a registering host. */
export const RELAY_ORIGIN = 'https://relay.fixture.example';
const origin = { type: 'text' as const, value: RELAY_ORIGIN };
/** A namespace whose objects fail, with words that must never reach a caller of the hub. */
const brokenScript = `import { DurableObject } from 'cloudflare:workers';
export class Broken extends DurableObject {
	async fetch() {
		return new Response('upstream detail: synthetic-secret', { status: 500 });
	}
}
export default { fetch() { return new Response('broken'); } };`;
const brokenBinding = { type: 'durable-object' as const, worker: 'broken', exportName: 'Broken' };

async function bundle(): Promise<string> {
	const result = await build({
		entryPoints: [entry],
		bundle: true,
		format: 'esm',
		target: 'es2022',
		platform: 'neutral',
		write: false,
		logLevel: 'silent'
	});
	return result.outputFiles[0].text;
}
/** A request to `/api/remote…` of one hub Worker, with a test session or with none. */
function caller(worker: { fetch(url: string, init?: RequestInit): Promise<Response> }): Call {
	return (session, method, path, body) => {
		const headers: Record<string, string> = {};
		if (session) headers['x-test-session'] = session;
		if (body !== undefined) headers['Content-Type'] = 'application/json';
		const init = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };
		const url = `https://hub.fixture.example/api/remote${path}`;
		/* The test's own connection to workerd is sometimes reset; that is not an answer. */
		return worker.fetch(url, init).catch(() => worker.fetch(url, init));
	};
}

/**
 * The hub's remote API and the relay, both in workerd: the hub reaches the host objects through
 * a namespace binding and through nothing else. Nothing leaves the machine.
 */
export async function startHubRelay() {
	const script = await bundle();
	const relay = await startRelay({
		workers: [
			{
				name: 'hub-app',
				script,
				env: { REMOTE_HOSTS: relayBinding, HARNESS_RELAY_ORIGIN: origin }
			},
			{ name: 'hub-unbound', script, env: { HARNESS_RELAY_ORIGIN: origin } },
			{ name: 'broken', script: brokenScript, objects: ['Broken'] },
			{
				name: 'hub-broken',
				script,
				env: { REMOTE_HOSTS: brokenBinding, HARNESS_RELAY_ORIGIN: origin }
			}
		]
	});
	return {
		relay,
		hub: caller(await relay.worker('hub-app')),
		unbound: caller(await relay.worker('hub-unbound')),
		broken: caller(await relay.worker('hub-broken')),
		stop: () => relay.stop()
	};
}

export async function accountPairing(hostId: string, keys: RemoteKeyPair) {
	const pairingId = randomId(),
		verifier = randomCredential();
	const phone = await remoteKeys(),
		ephemeral = await remoteKeys();
	const hostKey = keys.publicKey,
		ephemeralKey = ephemeral.publicKey;
	const secret = await sharedSecret(ephemeral.privateKey, hostKey);
	const envelope = await pairingEnvelope({ hostId, pairingId, ephemeralKey, hostKey, secret });
	const challenge = await pkceChallenge(verifier);
	const deviceKey = toBase64Url(phone.publicKey);
	const sealed = await sealPairing(envelope.request, 'request', {
		code: '',
		deviceKey,
		deviceName: 'Fixture iPhone',
		platform: 'test',
		challenge
	});
	const body = { ephemeralKey: toBase64Url(ephemeralKey), sealed, challenge };
	return {
		pairingId,
		verifier,
		approvalKey: envelope.approval,
		body,
		deviceId: await remoteIdentity(deviceKey)
	};
}

export async function approveAccountPairing(
	socket: RelaySocket,
	{ host, keys }: { host: TestHost; keys: RemoteKeyPair },
	{ pairingId, deviceId, grant }: { pairingId: string; deviceId: string; grant: RemoteGrant }
) {
	const frame = relayFrame(JSON.stringify(await socket.until('pairing-request')));
	if (frame?.type !== 'pairing-request')
		throw new Error('The Mac did not receive a pairing request.');
	expect(frame).toMatchObject({ pairingId, account: true });
	const mac = new HostPairingService({ keys, hostId: host.hostId });
	expect(await mac.receive(frame)).toMatchObject({
		pairingId,
		deviceId,
		deviceName: 'Fixture iPhone'
	});
	const approval = await mac.approve(pairingId, {
		deviceId,
		hostName: host.name,
		generation: 1,
		grant
	});
	expect(
		await command(socket, {
			type: 'pairing-approve',
			pairingId,
			deviceId,
			sealed: approval.sealed,
			challenge: approval.challenge
		})
	).toMatchObject({ ok: true });
	return approval;
}

export type { HubRelayFixture } from './hubRelayFixture.types';
