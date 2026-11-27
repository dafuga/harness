import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { VaultBrokerClientAdapter } from '../../../src/adapters/accounts-access/VaultBrokerClientAdapter';
import { VaultBrokerServerAdapter } from '../../../src/adapters/accounts-access/VaultBrokerServerAdapter';
import {
	approval,
	origin,
	sessionRequest,
	sessionUid,
	sign,
	vaultBroker
} from '../../support/credential-vault/broker';
import { PrivateBrowserGateService } from '../../../src/services/execution-runtimes/PrivateBrowserGateService';
import { PrivateBrowserPhoneService } from '../../../src/services/execution-runtimes/PrivateBrowserPhoneService';
import type { PrivateBrowserPhoneOffer } from '../../../src/services/execution-runtimes/PrivateBrowserPhoneService.types';
import { measureWorkload } from '../../support/measureWorkload';
import { canary, randomNonce } from '../../support/credential-vault/phone';

const open: VaultBrokerServerAdapter[] = [];
afterEach(async () => {
	await Promise.all(open.splice(0).map((server) => server.close()));
});

async function served(
	peer: number | null = sessionUid,
	configure: (fixture: ReturnType<typeof vaultBroker>) => object = () => ({})
) {
	const fixture = vaultBroker();
	const socketPath = join(fixture.state, 'sock', 'broker.sock');
	const server = new VaultBrokerServerAdapter({
		...fixture,
		...configure(fixture),
		socketPath,
		peerUid: () => peer
	});
	open.push(server);
	await server.listen();
	return { ...fixture, socketPath, client: new VaultBrokerClientAdapter({ socketPath }) };
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
	await expect(run.client.call('/v1/private-browser/offer', {})).rejects.toMatchObject({
		status: 404
	});
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

test('serves a scoped private entry offer and verifies sealed completion over the socket', async () => {
	await measureWorkload(
		'adapter.accounts-access-vault-broker-server',
		'serve-private-field',
		async () => {
			const checked = { submitted: false };
			const dispose = async () => undefined;
			const gate = new PrivateBrowserGateService({
				revokeInput: dispose,
				disposeForm: dispose,
				verifyResult: async () => checked.submitted
			});
			await gate.recover();
			let delivery: PrivateBrowserPhoneService | undefined;
			const run = await served(sessionUid, ({ devices, clock }) => {
				delivery = new PrivateBrowserPhoneService({
					devices,
					gate,
					now: () => clock.now,
					submitField: async (_scope, value) => {
						checked.submitted = value.equals(Buffer.from(canary.password));
					}
				});
				return { privateBrowser: delivery };
			});
			const request = await gate.request(run.phone.deviceId);
			const offer = delivery?.offer(request?.requestId ?? '', run.phone.deviceId, {
				executor: 'mb2-fixture',
				origin: 'https://provider.fixture.test',
				tabId: 'fixture-tab',
				field: 'fixture-password',
				action: 'submit-fixture',
				recipeDigest: 'b'.repeat(64)
			});
			if (!offer) throw new Error('Synthetic private offer was rejected');
			const challengePath = '/v1/private-browser/challenge';
			const signRoute = async (path: string, body?: object) => {
				const start = run.phone.prove(origin, challengePath, randomNonce(), {
					path,
					expiresAt: run.clock.now + 30_000
				});
				const { nonce } = await run.client.call<{ nonce: string }>(challengePath, start);
				await expect(run.client.call(challengePath, start)).rejects.toMatchObject({ status: 401 });
				return run.phone.prove(origin, path, nonce, body);
			};
			const offerPath = '/v1/private-browser/offer';
			const submitPath = '/v1/private-browser/submit';
			await expect(
				run.client.call(challengePath, { deviceId: run.phone.deviceId })
			).rejects.toMatchObject({ status: 400 });
			const unrelated = run.phone.prove(origin, challengePath, randomNonce(), {
				path: '/v1/device/decision',
				expiresAt: run.clock.now + 30_000
			});
			await expect(run.client.call(challengePath, unrelated)).rejects.toMatchObject({
				status: 400
			});
			await expect(run.client.call(offerPath, {})).rejects.toMatchObject({ status: 400 });
			const poll = await signRoute(offerPath);
			const response = await run.client.call<{ offer: PrivateBrowserPhoneOffer }>(offerPath, poll);
			expect(response).toEqual({ offer });
			await expect(run.client.call(offerPath, poll)).rejects.toMatchObject({ status: 401 });
			const copied = await signRoute(offerPath, { requestId: offer.requestId });
			await expect(run.client.call(offerPath, copied)).rejects.toMatchObject({ status: 400 });
			const { runnerPublicKey, ...scope } = response.offer;
			const sealed = run.seal.seal(runnerPublicKey, scope.requestId, Buffer.from(canary.password));
			const submission = await signRoute(submitPath, { ...scope, sealed });
			expect(await run.client.call(submitPath, submission)).toEqual({ status: 'completed' });
			expect(gate.receipt()).toEqual({ requestId: scope.requestId, outcome: 'completed' });
			expect(await run.client.call(submitPath, submission)).toEqual({ status: 'unavailable' });
			expect(await run.client.call(offerPath, await signRoute(offerPath))).toEqual({ offer: null });
			expect(JSON.stringify([response, gate.receipt(), run.audit.read()])).not.toContain(
				canary.password
			);
		}
	);
});
