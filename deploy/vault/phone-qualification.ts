import { lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { loadVaultPhone } from '../../packages/desktop/src/services/networking-security/remote-host-service/vaultPhone';
import { VaultBrokerClientAdapter } from '../../src/adapters/accounts-access/VaultBrokerClientAdapter';
import { VaultSealAdapter } from '../../src/adapters/accounts-access/VaultSealAdapter';
import type { VaultCreated } from '../../src/services/accounts-access/VaultBrokerService.types';
import { vaultRecipe } from '../../src/utils/accounts-access/vaultRecipe';
import {
	vaultDecision,
	VaultWireValidator
} from '../../src/validators/accounts-access/VaultWireValidator';
import type {
	VaultProof,
	VaultSessionRequest,
	VaultTicket
} from '../../src/validators/accounts-access/VaultWireValidator.types';
import { serveCredentialBroker } from '../../src/workflows/accounts-access/serveCredentialBroker';
import { syntheticExecutor } from '../../test/support/credential-vault/executor';
import { reviewed, syntheticRecipe } from '../../test/support/credential-vault/recipe';

const expectedToken = 'synthetic-ios-api-token';

/** Local, synthetic API-token qualification. The recipient verifies delivery without printing it. */
async function qualify(configPath: string, pinPath: string, peerAddon: string, expected: string) {
	const config = loadVaultPhone(resolve(configPath));
	const uid = process.getuid?.();
	if (!config || !uid || !['approved', 'denied'].includes(expected))
		throw new Error('Fixture inputs are invalid.');
	prepareSocket(config.socketPath, uid);
	const state = mkdtempSync(join(tmpdir(), 'vault-phone-'));
	const stop = new AbortController();
	const interrupt = () => stop.abort();
	process.once('SIGINT', interrupt);
	process.once('SIGTERM', interrupt);
	let service: Awaited<ReturnType<typeof serveCredentialBroker>> | undefined;
	try {
		const trust = join(state, 'trust.json');
		const signingKey = readFileSync(pinPath, 'utf8').trim();
		const executor = syntheticExecutor();
		writeFileSync(
			trust,
			JSON.stringify({
				devices: [{ id: config.deviceId, role: 'approver', signingKey }],
				executors: [executor.pin]
			}),
			{ mode: 0o600 }
		);
		service = await serveCredentialBroker({
			socket: config.socketPath,
			state,
			trust,
			origin: config.origin,
			peerAddon: resolve(peerAddon)
		});
		const client = new VaultBrokerClientAdapter({ socketPath: config.socketPath });
		await provePhoneDecision(client, executor, { uid, expected, signal: stop.signal });
	} finally {
		try {
			await service?.close();
		} finally {
			process.off('SIGINT', interrupt);
			process.off('SIGTERM', interrupt);
			rmSync(state, { recursive: true, force: true });
		}
	}
}

function prepareSocket(socketPath: string, uid: number): void {
	if (lstatSync(socketPath, { throwIfNoEntry: false }))
		throw new Error('The fixture socket is already occupied.');
	const parent = dirname(socketPath);
	mkdirSync(parent, { recursive: true, mode: 0o700 });
	const directory = lstatSync(parent);
	if (!directory.isDirectory() || directory.uid !== uid || (directory.mode & 0o777) !== 0o700) {
		throw new Error('Use an owner-only fixture socket directory.');
	}
}

async function provePhoneDecision(
	client: VaultBrokerClientAdapter,
	executor: ReturnType<typeof syntheticExecutor>,
	{ uid, expected, signal }: { uid: number; expected: string; signal: AbortSignal }
) {
	const runner = new VaultSealAdapter().runnerKey();
	const request = fixtureRequest(runner.publicKey);
	const { brokerId } = await client.call<{ brokerId: string }>('/v1/session/preflight', {});
	const issuedAt = Date.now();
	const preflight = executor.attest(request, {
		brokerId,
		uid,
		issuedAt,
		expiresAt: issuedAt + 120_000
	});
	const { requestId, receipt, expiresAt } = await client.call<VaultCreated>(
		'/v1/session/requests',
		{ ...request, preflight }
	);
	const ticket = { requestId, receipt };
	console.log(
		'Open Vault requests on the paired iPhone and choose ' +
			expected +
			' for the synthetic request.'
	);
	await waitForDecision(client, { ticket, expected, expiresAt, signal });
	if (expected === 'approved') await verifyDelivery(client, ticket, runner.open);
	console.log('PASS physical Vault fixture: ' + expected);
}

function fixtureRequest(runnerPublicKey: string): VaultSessionRequest {
	const source = syntheticRecipe();
	const { review, reviewers } = reviewed(source, Date.now());
	const { recipe, digest } = vaultRecipe(source, review, reviewers);
	return {
		item: 'jw0799',
		session: 'mb2-physical-fixture',
		project: 'harness',
		environment: 'synthetic',
		site: recipe.site,
		action: 'read-usage',
		account: recipe.account.alias,
		mode: 'read',
		method: 'api-token',
		recipe: { site: recipe.site, revision: recipe.revision, digest },
		host: 'mb2',
		runnerPublicKey,
		origins: recipe.origins,
		leaseMs: recipe.timeouts.leaseMs,
		reason: 'Verify the phone can seal the synthetic fixture token.'
	};
}

async function waitForDecision(
	client: VaultBrokerClientAdapter,
	input: { ticket: VaultTicket; expected: string; expiresAt: number; signal: AbortSignal }
) {
	while (Date.now() < input.expiresAt) {
		input.signal.throwIfAborted();
		const { status } = await client.call<{ status: string }>('/v1/session/status', input.ticket);
		if (status === input.expected) return;
		if (status !== 'pending') break;
		await setTimeout(300, undefined, { signal: input.signal });
	}
	throw new Error('The expected phone decision was not received.');
}

async function verifyDelivery(
	client: VaultBrokerClientAdapter,
	ticket: VaultTicket,
	open: ReturnType<VaultSealAdapter['runnerKey']>['open']
) {
	const { approval } = await client.call<{ approval: VaultProof }>('/v1/session/claim', ticket);
	const decision = new VaultWireValidator().json(
		vaultDecision,
		Buffer.from(approval.payload, 'base64url'),
		'decision'
	);
	if (decision.decision !== 'approve' || !decision.sealed)
		throw new Error('The phone did not seal the synthetic token.');
	const bytes = open(ticket.requestId, decision.sealed);
	try {
		if (JSON.parse(bytes.toString()).token !== expectedToken)
			throw new Error('Synthetic delivery mismatch.');
	} finally {
		bytes.fill(0);
	}
}

const args = process.argv.slice(2);
if (args.length !== 4) {
	console.error(
		'Usage: node phone-qualification.mjs <remote-config> <public-pin> <peer-addon> <approved|denied>'
	);
	process.exitCode = 2;
} else {
	try {
		await qualify(args[0], args[1], args[2], args[3]);
	} catch {
		console.error(
			'Vault qualification did not pass. Check the synthetic configuration, pin, and phone decision.'
		);
		process.exitCode = 1;
	}
}
