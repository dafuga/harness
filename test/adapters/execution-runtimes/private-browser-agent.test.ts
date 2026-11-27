import { createServer, get, request } from 'node:http';
import { rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { once } from 'node:events';
import { expect, test, vi } from 'vitest';
import { measureWorkload } from '../../support/measureWorkload';
import { PrivateBrowserAgentAdapter } from '../../../src/adapters/execution-runtimes/PrivateBrowserAgentAdapter';
import { VaultDeviceRepository } from '../../../src/repositories/accounts-access/VaultDeviceRepository';
import { PrivateBrowserPhoneService } from '../../../src/services/execution-runtimes/PrivateBrowserPhoneService';
import type { PrivateBrowserFieldScope } from '../../../src/services/execution-runtimes/PrivateBrowserPhoneService.types';
import { FakePhone } from '../../support/credential-vault/phone';
import { PrivateBrowserGateService } from '../../../src/services/execution-runtimes/PrivateBrowserGateService';
import { createTempDirectory } from '../../support/temporary';

const unexposed = ['/finish', '/screen', '/json/list', '/devtools', '/logs', '/recording'];
const agentUid = process.getuid?.() === 65534 ? 65533 : 65534;

function deviceDelivery(gate: PrivateBrowserGateService) {
	const phone = new FakePhone('paired-fixture');
	const origin = 'https://broker.fixture.test';
	const devices = new VaultDeviceRepository(
		[{ id: phone.deviceId, signingKey: phone.signingKey, role: 'approver' }],
		origin
	);
	const delivery = new PrivateBrowserPhoneService({
		gate,
		devices,
		submitField: async () => undefined
	});
	const reviewedField = vi.fn<() => PrivateBrowserFieldScope | undefined>(() => ({
		executor: 'fixture-executor',
		origin: 'https://provider.fixture.test',
		tabId: 'fixture-tab',
		field: 'fixture-field',
		action: 'submit-fixture',
		recipeDigest: 'a'.repeat(64)
	}));
	const activeOffer = () => {
		const { nonce } = devices.issue(phone.deviceId);
		return delivery.activeOffer(phone.prove(origin, '/v1/private-browser/offer', nonce));
	};
	return { deviceId: phone.deviceId, nativeEntry: { delivery, reviewedField }, activeOffer };
}

async function fixture() {
	const directory = await createTempDirectory('harness-private-agent-', '/tmp');
	const socketPath = join(directory, 'agent.sock');
	const gate = new PrivateBrowserGateService({
		revokeInput: async () => undefined,
		disposeForm: async () => undefined,
		verifyResult: async () => true
	});
	await gate.recover();
	const peerUid = vi.fn<() => number | null>(() => agentUid);
	const reviewedRead = vi.fn(async () => ({ state: 'reviewed' }));
	const device = deviceDelivery(gate);
	const adapter = new PrivateBrowserAgentAdapter({
		socketPath,
		agentUid,
		peerUid,
		gate,
		deviceId: device.deviceId,
		...{ nativeEntry: device.nativeEntry },
		reviewedRead
	});

	const close = async () => {
		try {
			await adapter.close?.();
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	};
	return { adapter, socketPath, close, peerUid, gate, reviewedRead, ...device };
}

function call(socketPath: string, path: string, method = 'POST', body?: string) {
	const headers = body ? { 'Content-Length': Buffer.byteLength(body) } : {};
	return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
		const req = request({ socketPath, path, method, headers, agent: false }, (response) => {
			response.setEncoding('utf8');
			let raw = '';
			response.on('data', (chunk: string) => (raw += chunk));
			response.on('end', () =>
				resolve({ status: response.statusCode ?? 0, body: JSON.parse(raw) as unknown })
			);
		});
		req.once('error', reject);
		req.end(body);
	});
}

test('listen fails closed for an unverified or wrong agent identity', async () => {
	const { adapter, socketPath, close, peerUid, reviewedRead } = await fixture();
	try {
		await adapter.listen();
		expect(statSync(socketPath).mode & 0o777).toBe(0o660);
		peerUid.mockReturnValue(null);
		expect(await call(socketPath, '/status', 'GET')).toEqual({
			status: 403,
			body: { error: 'Forbidden' }
		});
		peerUid.mockReturnValue(agentUid - 1);
		expect(await call(socketPath, '/read')).toEqual({ status: 403, body: { error: 'Forbidden' } });
		expect(reviewedRead).not.toHaveBeenCalled();
	} finally {
		await close();
	}
});

test('only reviewed reads, request and status are exposed and private entry blocks all reads', async () => {
	await measureWorkload(
		'adapter.execution-runtimes-private-browser-agent',
		'unix-agent-read-and-private-refusal',
		async () => {
			const { adapter, socketPath, close, gate, reviewedRead, activeOffer } = await fixture();
			try {
				await adapter.listen();
				expect(await call(socketPath, '/status', 'GET')).toEqual({
					status: 200,
					body: { phase: 'ready' }
				});
				expect(await call(socketPath, '/read')).toEqual({
					status: 200,
					body: { result: { state: 'reviewed' } }
				});
				expect(await call(socketPath, '/private-entry', 'POST', '{"deviceId":"forged"}')).toEqual({
					status: 400,
					body: { error: 'Body not allowed' }
				});
				const admitted = await call(socketPath, '/private-entry');
				expect(admitted).toEqual({ status: 202, body: { requestId: expect.any(String) } });
				expect(await call(socketPath, '/status', 'GET')).toEqual({
					status: 200,
					body: { phase: 'private' }
				});
				for (const path of unexposed) {
					expect(await call(socketPath, path)).toEqual({
						status: 404,
						body: { error: 'Unknown route' }
					});
				}
				expect(await call(socketPath, '/read')).toEqual({
					status: 409,
					body: { error: 'Read unavailable' }
				});
				expect(reviewedRead).toHaveBeenCalledTimes(1);
				const { requestId } = admitted.body as { requestId: string };
				expect(activeOffer()).toMatchObject({ requestId, field: 'fixture-field' });
				expect(await gate.finish(requestId, 'paired-fixture')).toBe(true);
				expect(await call(socketPath, '/status', 'GET')).toEqual({
					status: 200,
					body: { phase: 'ready', receipt: { requestId, outcome: 'completed' } }
				});
				expect((await call(socketPath, '/read')).status).toBe(200);
			} finally {
				await close();
			}
		}
	);
});

test('close preserves a socket whose bind failed because another service owns the name', async () => {
	const { adapter, socketPath, close } = await fixture();
	const existing = createServer((_request, response) => response.end('existing'));
	try {
		existing.listen(socketPath);
		await once(existing, 'listening');
		await expect(adapter.listen()).rejects.toMatchObject({ code: 'EADDRINUSE' });
		await adapter.close();
		const response = await new Promise<number | undefined>((resolve, reject) => {
			get({ socketPath, agent: false }, (message) => {
				message.resume();
				resolve(message.statusCode);
			}).once('error', reject);
		});
		expect(response).toBe(200);
	} finally {
		await new Promise<void>((resolve) => existing.close(() => resolve()));
		await close();
	}
});

test('an unavailable native offer cancels admission without exposing a private request', async () => {
	const { adapter, socketPath, close, nativeEntry, activeOffer, gate } = await fixture();
	try {
		await adapter.listen();
		nativeEntry.reviewedField.mockReturnValueOnce(undefined);
		expect(await call(socketPath, '/private-entry')).toEqual({
			status: 409,
			body: { error: 'Private entry unavailable' }
		});
		expect(activeOffer()).toBeUndefined();
		expect(gate.receipt()?.outcome).toBe('aborted');
		expect((await call(socketPath, '/read')).status).toBe(200);
	} finally {
		await close();
	}
});
