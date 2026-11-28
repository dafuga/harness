import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { VaultBrokerClientAdapter } from '../../../src/adapters/accounts-access/VaultBrokerClientAdapter';
import { VaultBrokerServerAdapter } from '../../../src/adapters/accounts-access/VaultBrokerServerAdapter';
import { VaultPaymentService } from '../../../src/services/accounts-access/VaultPaymentService';
import {
	approval,
	origin,
	sessionRequest,
	sessionUid,
	sign,
	vaultBroker
} from '../../support/credential-vault/broker';
import { canary } from '../../support/credential-vault/phone';

const open: VaultBrokerServerAdapter[] = [];
afterEach(async () => {
	await Promise.all(open.splice(0).map((server) => server.close()));
});

async function served(peer: number | null = sessionUid, enablePayments = false) {
	const fixture = vaultBroker();
	const socketPath = join(fixture.state, 'sock', 'broker.sock');
	const payments = new VaultPaymentService({
		...fixture,
		host: 'mb2',
		now: () => fixture.clock.now
	});
	payments.setEnabled(enablePayments);
	const server = new VaultBrokerServerAdapter({
		...fixture,
		socketPath,
		peerUid: () => peer,
		payments: enablePayments ? payments : undefined
	});
	open.push(server);
	await server.listen();
	return { ...fixture, payments, socketPath, client: new VaultBrokerClientAdapter({ socketPath }) };
}

test('a synthetic request goes from session to phone to lease over the socket', async () => {
	const run = await served();
	expect(statSync(dirname(run.socketPath)).mode & 0o777).toBe(0o700);
	expect(statSync(run.socketPath).mode & 0o777).toBe(0o600);
	const runner = run.seal.runnerKey();
	const input = sessionRequest(runner);
	const created = await run.client.call<{
		requestId: string;
		receipt: string;
		runnerFingerprint: string;
		expiresAt: number;
	}>('/v1/session/requests', input);
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

test('without a kernel-verified peer the broker files requests but refuses a CDP lease', async () => {
	const run = await served(null);
	const input = sessionRequest(run.seal.runnerKey());
	const created = await run.client.call<{
		requestId: string;
		receipt: string;
		runnerFingerprint: string;
		expiresAt: number;
	}>('/v1/session/requests', input);
	const ticket = { requestId: created.requestId, receipt: created.receipt };
	await run.client.call('/v1/device/decision', sign(run, input, approval(input, created, run)));
	await run.client.call('/v1/session/claim', ticket);
	const teardown = { logout: null, revoke: null, securityLog: null };
	await expect(
		run.client.call('/v1/session/lease', { ...ticket, identity: 'owner@example.test', teardown })
	).rejects.toMatchObject({ status: 403 });
});

test('only signed device routes can see and approve a protected executor purchase offer', async () => {
	const disabled = await served();
	const queuePath = '/v1/device/purchase/requests';
	const decisionPath = '/v1/device/purchase/decision';
	await expect(disabled.client.call(queuePath, {})).rejects.toMatchObject({ status: 404 });
	const run = await served(sessionUid, true);
	const checkout = {
		merchant: 'fixture-store',
		origin: 'https://checkout.stripe.com',
		binding: 'a'.repeat(64),
		amountMinor: 3500,
		currency: 'CAD',
		mode: 'stripe-test'
	};
	const offer = run.payments.request({
		checkout,
		description: 'Fixture purchase',
		item: '25e3ygwc13',
		session: 'fixture-session',
		card: { id: 'd'.repeat(32), lastFour: '4242' },
		recipeDigest: 'b'.repeat(64),
		runnerFingerprint: 'c'.repeat(64)
	});
	await expect(run.client.call('/v1/session/purchase/claim', offer)).rejects.toMatchObject({
		status: 404
	});
	await expect(run.client.call(queuePath, {})).rejects.toMatchObject({ status: 400 });
	const challenge = () =>
		run.client.call<{ nonce: string }>('/v1/device/challenge', {
			deviceId: run.phone.deviceId
		});
	const queue = await run.client.call(
		queuePath,
		run.phone.prove(origin, queuePath, (await challenge()).nonce)
	);
	expect(queue).toEqual([offer]);
	const { requestId, scope } = offer;
	const decision = run.phone.prove(origin, decisionPath, (await challenge()).nonce, {
		requestId,
		scope,
		decision: 'approve',
		expiresAt: run.clock.now + 30_000
	});
	expect(await run.client.call(decisionPath, decision)).toEqual({ status: 'approved' });
	expect(run.payments.claim(requestId, checkout, scope.runnerFingerprint)).toEqual({
		requestId,
		scope,
		expiresAt: run.clock.now + 30_000
	});
});
