import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { VaultBrokerClientAdapter } from '../../../src/adapters/accounts-access/VaultBrokerClientAdapter';
import { VaultBrokerServerAdapter } from '../../../src/adapters/accounts-access/VaultBrokerServerAdapter';
import { VaultRunnerPreflightService } from '../../../src/services/accounts-access/VaultRunnerPreflightService';
import {
	approval,
	origin,
	sessionRequest,
	sessionUid,
	sign,
	vaultBroker
} from '../../support/credential-vault/broker';
import { syntheticExecutor } from '../../support/credential-vault/executor';
import { canary } from '../../support/credential-vault/phone';

const open: VaultBrokerServerAdapter[] = [];
afterEach(async () => {
	await Promise.all(open.splice(0).map((server) => server.close()));
});

async function served(peer: number | null = sessionUid) {
	const fixture = vaultBroker();
	const executor = syntheticExecutor();
	const preflight = new VaultRunnerPreflightService([executor.pin], () => fixture.clock.now);
	const socketPath = join(fixture.state, 'sock', 'broker.sock');
	const server = new VaultBrokerServerAdapter({
		...fixture,
		preflight,
		socketPath,
		peerUid: () => peer
	});
	open.push(server);
	await server.listen();
	const client = new VaultBrokerClientAdapter({ socketPath });
	const { brokerId } = await client.call<{ brokerId: string }>('/v1/session/preflight', {});
	const authorization = (input: ReturnType<typeof sessionRequest>) =>
		executor.attest(input, {
			brokerId,
			uid: sessionUid,
			issuedAt: fixture.clock.now,
			expiresAt: fixture.clock.now + 45_000
		});
	return { ...fixture, socketPath, client, authorization };
}

test('a synthetic request goes from session to phone to lease over the socket', async () => {
	const run = await served();
	expectPrivateSocket(run.socketPath);
	const runner = run.seal.runnerKey();
	const input = sessionRequest(runner);
	const submitted = { ...input, preflight: run.authorization(input) };
	const created = await run.client.call<{
		requestId: string;
		receipt: string;
		runnerFingerprint: string;
		expiresAt: number;
	}>('/v1/session/requests', submitted);
	expect(created.expiresAt).toBe(submitted.preflight.expiresAt);
	await expect(run.client.call('/v1/session/requests', submitted)).rejects.toMatchObject({
		status: 409
	});
	const ticket = { requestId: created.requestId, receipt: created.receipt };
	const { nonce } = await run.client.call<{ nonce: string }>('/v1/device/challenge', {
		deviceId: run.phone.deviceId
	});
	const queue = await run.client.call<unknown[]>(
		'/v1/device/requests',
		run.phone.prove(origin, '/v1/device/requests', nonce)
	);
	expect(queue).toHaveLength(1);
	const decision = sign(run, input, approval(input, created, run));
	expect(await run.client.call('/v1/device/decision', decision)).toEqual({ status: 'approved' });
	const claimed = await run.client.call<{ approval: { payload: string } }>(
		'/v1/session/claim',
		ticket
	);
	const payload = JSON.parse(Buffer.from(claimed.approval.payload, 'base64url').toString('utf8'));
	expect(JSON.parse(runner.open(created.requestId, payload.sealed).toString())).toMatchObject(
		canary
	);
	const teardown = { logout: '/logout', revoke: null, securityLog: 'audit-page' };
	const { lease } = await run.client.call<{ lease: string }>('/v1/session/lease', {
		...ticket,
		identity: 'owner@example.test',
		teardown
	});
	const attached = await run.client.call<{ endpoint: string; headers: { Authorization: string } }>(
		'/v1/session/attach',
		{ lease, session: input.session }
	);
	expect(attached.endpoint).toContain('/cdp.sock:/devtools/browser');
	const ended = await run.client.call<{ ended: string }>('/v1/session/finish', {
		lease,
		session: input.session
	});
	expect(ended.ended).toBe('finished');
	const everything = JSON.stringify([queue, claimed, attached, ended, run.audit.read()]);
	expect(everything).not.toContain(canary.password);
	expect(everything).not.toContain(canary.otp);
});

function expectPrivateSocket(path: string): void {
	expect(statSync(dirname(path)).mode & 0o777).toBe(0o700);
	expect(statSync(path).mode & 0o777).toBe(0o600);
}

test('refusals carry a status and never echo the rejected value', async () => {
	const run = await served();
	await expect(run.client.call('/v1/nowhere', {})).rejects.toMatchObject({ status: 404 });
	const bad = { ...sessionRequest(run.seal.runnerKey()), reason: canary.password + '\n' };
	const refused = await run.client.call('/v1/session/requests', bad).catch((error: Error) => error);
	expect(refused).toMatchObject({ status: 400, message: 'Invalid request at reason.' });
	expect(String((refused as Error).message)).not.toContain(canary.password);
	const ticket = { requestId: 'a'.repeat(32), receipt: Buffer.alloc(32, 1).toString('base64url') };
	await expect(run.client.call('/v1/session/status', ticket)).rejects.toMatchObject({
		status: 404
	});
});

test('an unattested request or an unknown peer never reaches the phone', async () => {
	const run = await served(null);
	const input = sessionRequest(run.seal.runnerKey());
	const known = await served();
	await expect(known.client.call('/v1/session/requests', input)).rejects.toMatchObject({
		status: 403
	});
	await expect(
		run.client.call('/v1/session/requests', { ...input, preflight: run.authorization(input) })
	).rejects.toMatchObject({ status: 403 });
	for (const server of [run, known]) {
		const { nonce } = server.devices.issue(server.phone.deviceId);
		const proof = server.phone.prove(origin, '/v1/device/requests', nonce);
		expect(await server.client.call('/v1/device/requests', proof)).toEqual([]);
		expect(server.audit.read()).toEqual([]);
	}
});
