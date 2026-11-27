import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { beforeAll, expect, test } from 'vitest';
import { VaultDeviceRepository } from '../src/repositories/accounts-access/VaultDeviceRepository';
import { VaultBrokerService } from '../src/services/accounts-access/VaultBrokerService';
import { privateBrowserPhonePaths } from '../src/services/execution-runtimes/PrivateBrowserPhoneService';
import type { PrivateBrowserPhoneOffer } from '../src/services/execution-runtimes/PrivateBrowserPhoneService.types';
import type { VaultQueueEntry } from '../src/services/accounts-access/VaultBrokerService.types';
import type {
	VaultApproval,
	VaultProof,
	VaultSessionRequest
} from '../src/validators/accounts-access/VaultWireValidator.types';
import {
	origin,
	privateBrowserExecutorFixture,
	sessionRequest,
	vaultBroker
} from './support/credential-vault/broker';
import { randomNonce } from './support/credential-vault/phone';
import type { NativeVaultTestRun } from './credential-vault-ios.e2e.test.types';

const deviceId = 'synthetic-native-iphone';
const ios = 'packages/desktop/ios/App/App';
const refused = { error: 'Native Vault refused the request.' };
let binary: string;
beforeAll(() => {
	if (process.platform === 'darwin')
		binary = compileNativePhone(join(vaultBroker().state, 'phone'));
}, 65_000);

test.skipIf(process.platform !== 'darwin')(
	'Harness iOS signs the broker queue and decisions and seals to the checked runner',
	async () => {
		const fixture = vaultBroker();
		fixture.clock.now = Date.now();
		const phone = nativePhone(binary);
		try {
			const { signingKey } = await phone.read<{ signingKey: string }>();
			const now = () => fixture.clock.now;
			const devices = new VaultDeviceRepository(
				[{ id: deviceId, signingKey, role: 'approver' }],
				origin
			);
			const broker = new VaultBrokerService(devices, fixture.audit, now);
			const run = { fixture, phone, devices, broker };
			await verifyDecision(run, 'browser', 'password', { password: 'synthetic-ios-password' });
			await verifyDecision(run, 'api-token', 'token', { token: 'synthetic-ios-api-token' });
			await verifyDecision(run, 'oauth-device', 'grant', null);
			await verifyDecision(run, 'browser', 'deny', null);
			await verifyPrivateField(run, signingKey);
			await verifyPrivateField(run, signingKey, [
				'fixture-account',
				'fixture-code',
				'fixture-challenge'
			]);
		} finally {
			await phone.close();
		}
	},
	30_000
);

test.skipIf(process.platform !== 'darwin')(
	'Harness iOS opens the standalone broker’s legacy add fixture and refuses changed envelopes',
	() => void execFileSync(binary, ['test/support/credential-vault/legacy-vault-add-vector.json'])
);

function compileNativePhone(binary: string): string {
	const core = `${ios}/Vault/Core`;
	const vaultSources = readdirSync(core).filter((file) => file.endsWith('.swift'));
	const swiftArguments = [
		'swiftc',
		`${ios}/Remote/RemoteCoding.swift`,
		`${ios}/Vault/VaultApprovalRequest.swift`,
		`${ios}/Vault/VaultApprovalCrypto.swift`,
		`${ios}/Vault/VaultLegacyAdd.swift`,
		...vaultSources.map((file) => join(core, file)),
		'test/support/credential-vault/iosPhone.swift',
		'test/support/credential-vault/iosLegacyAdd.swift',
		'-o',
		binary
	];
	execFileSync('xcrun', swiftArguments, { timeout: 60_000 });
	return binary;
}

function nativePhone(binary: string) {
	const child = spawn(binary, [], { stdio: ['pipe', 'pipe', 'ignore'] });
	const closed = once(child, 'close');
	const lines = createInterface({ input: child.stdout });
	const iterator = lines[Symbol.asyncIterator]();
	async function read<T>(): Promise<T> {
		const line = await iterator.next();
		if (line.done) throw new Error('The synthetic native phone ended early.');
		return JSON.parse(line.value) as T;
	}
	return {
		read,
		write<T>(body: unknown): Promise<T> {
			child.stdin.write(JSON.stringify(body) + '\n');
			return read<T>();
		},
		async close(): Promise<void> {
			child.stdin.end();
			await closed;
			lines.close();
		}
	};
}

async function verifyDecision(
	run: NativeVaultTestRun,
	method: VaultSessionRequest['method'],
	decision: string,
	credential: Record<string, string> | null
): Promise<void> {
	const runner = run.fixture.seal.runnerKey();
	const uid = process.getuid!();
	const ticket = run.broker.create(sessionRequest(runner, { method }), uid);
	const queue = await run.phone.write<VaultProof>(challenge(run));
	const request = run.broker.queue(queue).find((entry) => entry.requestId === ticket.requestId);
	if (!request) throw new Error('The native phone could not read the pending request.');
	expect(() => run.broker.queue(queue)).toThrow('invalid or expired');
	if (decision === 'password') await verifyNativeRefusals(run, request);
	const proof = await run.phone.write<VaultProof>({ ...challenge(run), request, decision });
	expect(run.broker.decide(proof)).toBe(decision === 'deny' ? 'denied' : 'approved');
	expect(() => run.broker.decide(proof)).toThrow('pending request');
	if (decision === 'deny') return;
	const delivered = { requestId: ticket.requestId, receipt: ticket.receipt };
	const { approval } = run.broker.claim(delivered, uid);
	const payload = JSON.parse(
		Buffer.from(approval.payload, 'base64url').toString()
	) as VaultApproval;
	if (payload.sealed) {
		const opened = runner.open(ticket.requestId, payload.sealed);
		try {
			expect(JSON.parse(opened.toString())).toEqual(credential);
		} finally {
			opened.fill(0);
		}
	} else {
		expect(credential).toBeNull();
	}
}

function challenge(run: NativeVaultTestRun) {
	return { origin, deviceId, ...run.devices.issue(deviceId) };
}

async function verifyNativeRefusals(
	run: NativeVaultTestRun,
	request: VaultQueueEntry
): Promise<void> {
	const wrongKey = { ...request, runnerPublicKey: run.fixture.seal.runnerKey().publicKey };
	const expired = { ...request, expiresAt: Date.now() - 1 };
	for (const bad of [wrongKey, expired]) {
		const result = await run.phone.write({ ...challenge(run), request: bad, decision: 'password' });
		expect(result).toEqual(refused);
	}
	const wrongMethod = await run.phone.write({ ...challenge(run), request, decision: 'token' });
	expect(wrongMethod).toEqual(refused);
}

async function verifyPrivateField(run: NativeVaultTestRun, signingKey: string, fields?: string[]) {
	const executor = await privateBrowserExecutorFixture(
		run.fixture.state,
		{ id: deviceId, signingKey },
		fields
	);
	const { challenge, offer, submit } = privateBrowserPhonePaths;
	const proof = (path: string, nonce: string, payload: object) =>
		run.phone.write<VaultProof>({
			origin,
			deviceId,
			nonce,
			expiresAt: Date.now() + 20_000,
			privateRequest: { path, payload: Buffer.from(JSON.stringify(payload)).toString('base64url') }
		});
	const issue = async (path: string) => {
		const start = await proof(challenge, randomNonce(), { path, expiresAt: Date.now() + 20_000 });
		return executor.client.call<{ nonce: string; expiresAt: number }>(challenge, start);
	};
	try {
		const [status, receipt] = await executor.agent('/private-entry');
		expect(status).toBe(202);
		expect(await executor.agent('/read')).toEqual([409, { error: 'Read unavailable' }]);
		const polling = await proof(offer, (await issue(offer)).nonce, {});
		const { offer: privateOffer } = await executor.client.call<{ offer: PrivateBrowserPhoneOffer }>(
			offer,
			polling
		);
		expect(privateOffer).toMatchObject({
			...receipt,
			field: fields ? 'fixture-form' : 'fixture-code'
		});
		const submission = { origin, deviceId, ...(await issue(submit)) };
		const bad = { ...privateOffer, runnerFingerprint: 'a'.repeat(64) };
		expect(await run.phone.write({ ...submission, privateOffer: bad })).toEqual(refused);
		const sealed = await run.phone.write<VaultProof>({ ...submission, privateOffer });
		const payload = JSON.parse(Buffer.from(sealed.payload, 'base64url').toString('utf8'));
		expect(payload).not.toHaveProperty('runnerPublicKey');
		expect(payload).not.toHaveProperty('plaintext');
		expect(await executor.client.call(submit, sealed)).toEqual({ status: 'completed' });
		expect(await executor.client.call(submit, sealed)).toEqual({ status: 'unavailable' });
		expect(executor.disposed()).toBe(2);
		expect(await executor.agent('/status', 'GET')).toEqual([
			200,
			{ phase: 'ready', receipt: { requestId: privateOffer.requestId, outcome: 'completed' } }
		]);
		expect(await executor.agent('/read')).toEqual([200, { result: 'ordinary result' }]);
	} finally {
		await executor.close();
	}
}
