import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { expect, test } from 'vitest';
import { VaultDeviceRepository } from '../src/repositories/accounts-access/VaultDeviceRepository';
import { VaultBrokerService } from '../src/services/accounts-access/VaultBrokerService';
import type { VaultQueueEntry } from '../src/services/accounts-access/VaultBrokerService.types';
import type {
	VaultApproval,
	VaultProof,
	VaultSessionRequest
} from '../src/validators/accounts-access/VaultWireValidator.types';
import { origin, sessionRequest, vaultBroker } from './support/credential-vault/broker';
import type { NativeVaultTestRun } from './credential-vault-ios.e2e.test.types';

const deviceId = 'synthetic-native-iphone';
const ios = 'packages/desktop/ios/App/App';
const refused = { error: 'Native Vault refused the request.' };

test.skipIf(process.platform !== 'darwin')(
	'Harness iOS signs the broker queue and decisions and seals to the checked runner',
	async () => {
		const fixture = vaultBroker();
		fixture.clock.now = Date.now();
		const binary = compileNativePhone(join(fixture.state, 'phone'));
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
			await verifyDecision(run, 'browser', 'generate-password', null);
		} finally {
			await phone.close();
		}
	},
	30_000
);

test.skipIf(process.platform !== 'darwin')(
	'Harness iOS opens the standalone broker’s legacy add fixture and refuses changed envelopes',
	() => {
		const binary = compileNativePhone(join(vaultBroker().state, 'legacy-add'));
		execFileSync(binary, ['test/support/credential-vault/legacy-vault-add-vector.json']);
	},
	30_000
);

function compileNativePhone(binary: string): string {
	execFileSync('xcrun', [
		'swiftc',
		`${ios}/Remote/RemoteCoding.swift`,
		`${ios}/Vault/VaultApprovalRequest.swift`,
		`${ios}/Vault/VaultApprovalCrypto.swift`,
		`${ios}/Vault/VaultLegacyAdd.swift`,
		'test/support/credential-vault/iosPhone.swift',
		'test/support/credential-vault/iosLegacyAdd.swift',
		'-o',
		binary
	]);
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
	const generated = decision === 'generate-password';
	const broker = generated
		? new VaultBrokerService(
				run.devices,
				run.fixture.audit,
				() => run.fixture.clock.now,
				() => async () => undefined
			)
		: run.broker;
	const ticket = broker.create(
		sessionRequest(runner, {
			method,
			...(generated && { action: 'generate-password', mode: 'write' })
		}),
		uid
	);
	const queue = await run.phone.write<VaultProof>(challenge(run));
	const request = broker.queue(queue).find((entry) => entry.requestId === ticket.requestId);
	if (!request) throw new Error('The native phone could not read the pending request.');
	expect(() => broker.queue(queue)).toThrow('invalid or expired');
	if (decision === 'password') await verifyNativeRefusals(run, request);
	const proof = await run.phone.write<VaultProof>({ ...challenge(run), request, decision });
	expect(broker.decide(proof)).toBe(decision === 'deny' ? 'denied' : 'approved');
	expect(() => broker.decide(proof)).toThrow('pending request');
	if (decision === 'deny') return;
	const delivered = { requestId: ticket.requestId, receipt: ticket.receipt };
	if (generated) {
		const payload = JSON.parse(Buffer.from(proof.payload, 'base64url').toString()) as VaultApproval;
		expect(payload).toMatchObject({
			sealed: null,
			project: request.project,
			environment: request.environment
		});
		await expect(broker.generatePassword(delivered, uid)).resolves.toBe('completed');
		return;
	}
	const { approval } = broker.claim(delivered, uid);
	verifyOpenedDecision(approval, delivered.requestId, runner, credential);
}

function verifyOpenedDecision(
	approval: VaultProof,
	requestId: string,
	runner: ReturnType<ReturnType<typeof vaultBroker>['seal']['runnerKey']>,
	credential: Record<string, string> | null
): void {
	const payload = JSON.parse(
		Buffer.from(approval.payload, 'base64url').toString()
	) as VaultApproval;
	if (payload.sealed) {
		const opened = runner.open(requestId, payload.sealed);
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
