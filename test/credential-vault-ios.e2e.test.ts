import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { expect, test } from 'vitest';
import type { VaultQueueEntry } from '../src/services/accounts-access/VaultBrokerService.types';
import type {
	VaultApproval,
	VaultProof,
	VaultSessionRequest
} from '../src/validators/accounts-access/VaultWireValidator.types';
import { origin, sessionRequest, sessionUid, vaultBroker } from './support/credential-vault/broker';
import { remoteInbox } from './support/credential-vault/remoteInbox';
import type { NativeVaultTestRun } from './credential-vault-ios.e2e.test.types';

const deviceId = 'synthetic-native-iphone';
const ios = 'packages/desktop/ios/App/App';
const refused = { error: 'Native Vault refused the request.' };

test.skipIf(process.platform !== 'darwin')(
	'Harness iOS uses the paired inbox and seals to the preflighted runner',
	async () => {
		const fixture = vaultBroker();
		fixture.clock.now = Date.now();
		const binary = compileNativePhone(join(fixture.state, 'phone'));
		execFileSync(binary, ['--device-guards']);
		const phone = nativePhone(binary);
		try {
			const { signingKey } = await phone.read<{ signingKey: string }>();
			const inbox = await remoteInbox(fixture, deviceId, signingKey);
			try {
				const run = { fixture, phone, inbox };
				expect(await inbox.call('vaultInfo', {})).toEqual({ origin, deviceId });
				await verifyDecision(run, 'browser', 'password', { password: 'synthetic-ios-password' });
				await verifyDecision(run, 'api-token', 'token', { token: 'synthetic-ios-api-token' });
				await verifyDecision(run, 'oauth-device', 'grant', null);
				await verifyDecision(run, 'browser', 'deny', null);
			} finally {
				await inbox.close();
			}
		} finally {
			await phone.close();
		}
	},
	30_000
);

test.skipIf(process.platform !== 'darwin')(
	'Harness iOS accepts a reviewed legacy import and returns a receipt after storage',
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
		`${ios}/Vault/VaultLegacyImportReview.swift`,
		`${ios}/Vault/VaultLegacyImportKeychain.swift`,
		`${ios}/Vault/VaultFaceID.swift`,
		`${ios}/Vault/VaultDeviceApproval.swift`,
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
	const ticket = await run.inbox.create(sessionRequest(runner, { method }));
	const queue = await run.phone.write<VaultProof>(await challenge(run));
	await expect(
		run.inbox.call('vaultQueue', { ...queue, deviceId: 'another-phone' })
	).rejects.toMatchObject({ code: 'method-denied' });
	const entries = (await run.inbox.call('vaultQueue', queue)) as VaultQueueEntry[];
	const request = entries.find((entry) => entry.requestId === ticket.requestId);
	if (!request) throw new Error('The native phone could not read the pending request.');
	await expect(run.inbox.call('vaultQueue', queue)).rejects.toMatchObject({
		code: 'method-denied'
	});
	if (decision === 'password') await verifyNativeRefusals(run, request);
	const proof = await run.phone.write<VaultProof>({ ...(await challenge(run)), request, decision });
	expect(await run.inbox.call('vaultDecision', proof)).toEqual({
		status: decision === 'deny' ? 'denied' : 'approved'
	});
	await expect(run.inbox.call('vaultDecision', proof)).rejects.toMatchObject({
		code: 'method-denied'
	});
	if (decision === 'deny') return;
	const delivered = { requestId: ticket.requestId, receipt: ticket.receipt };
	const { approval } = run.inbox.broker.claim(delivered, sessionUid);
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

async function challenge(run: NativeVaultTestRun) {
	return (await run.inbox.call('vaultChallenge', {})) as {
		origin: string;
		deviceId: string;
		nonce: string;
		expiresAt: number;
	};
}

async function verifyNativeRefusals(
	run: NativeVaultTestRun,
	request: VaultQueueEntry
): Promise<void> {
	const wrongKey = { ...request, runnerPublicKey: run.fixture.seal.runnerKey().publicKey };
	const expired = { ...request, expiresAt: Date.now() - 1 };
	for (const bad of [wrongKey, expired]) {
		const result = await run.phone.write({
			...(await challenge(run)),
			request: bad,
			decision: 'password'
		});
		expect(result).toEqual(refused);
	}
	const wrongMethod = await run.phone.write({
		...(await challenge(run)),
		request,
		decision: 'token'
	});
	expect(wrongMethod).toEqual(refused);
}
