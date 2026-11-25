import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect } from 'vitest';
import { VaultBrokerClientAdapter } from '../../../src/adapters/accounts-access/VaultBrokerClientAdapter';
import type { VaultQueueEntry } from '../../../src/services/accounts-access/VaultBrokerService.types';
import type {
	VaultApproval,
	VaultSessionRequest
} from '../../../src/validators/accounts-access/VaultWireValidator.types';
import { approval, origin, vaultBroker } from './broker';
import { approved, withHttpsFixture } from './dockerBrowser';
import { signupFixtureRecipe } from './recipe';

export async function verifyPasswordSignup(image: string) {
	const run = vaultBroker();
	const keychain = join(run.state, 'signup.keychain');
	const fixture = compile(
		'test/support/credential-vault/passwordKeychain.swift',
		join(run.state, 'keychain')
	);
	const helper = compile('deploy/vault/store-password.swift', join(run.state, 'writer'));
	fixture(keychain, 'create');
	try {
		await withHttpsFixture(image, 'email', async ({ id, ip, securityLog }) => {
			const settings = {
				keychain,
				keychainHelper: helper(),
				image,
				seccomp: resolve('deploy/vault/seccomp.json'),
				dockerContext: process.env.HARNESS_TEST_VAULT_DOCKER_CONTEXT!,
				network: { id, hosts: { [new URL(approved).hostname]: ip } }
			};
			await verifySignupCommand(run, settings);
			fixture(keychain, 'verify');
			const status = JSON.parse(await securityLog());
			expect(status.active).toBe(0);
			expect(status.events.map(({ kind }: { kind: string }) => kind)).toEqual(['signup', 'other']);
		});
	} finally {
		fixture(keychain, 'delete');
	}
}

function compile(source: string, binary: string) {
	execFileSync('/usr/bin/xcrun', ['swiftc', source, '-o', binary], { stdio: 'ignore' });
	return (...args: string[]) => {
		if (args.length) execFileSync(binary, args, { stdio: 'ignore' });
		return binary;
	};
}

async function verifySignupCommand(run: ReturnType<typeof vaultBroker>, settings: object) {
	const files = signupBrokerFiles(run, settings);
	const socketPath = join(run.state, 'broker', 'vault.sock');
	const state = join(run.state, 'server');
	const launch = [
		process.env.HARNESS_TEST_VAULT_CLI ?? 'src/cli/index.ts',
		'credential',
		'--socket',
		socketPath
	];
	const env = { ...process.env, HARNESS_ANALYTICS_DISABLED: '1', HARNESS_AGENT_ID: '' };
	const child = spawn(
		'bun',
		[
			...launch,
			'serve',
			'--state',
			state,
			'--trust',
			files.trust,
			'--origin',
			origin,
			'--password-config',
			files.config
		],
		{
			env,
			stdio: ['ignore', 'pipe', 'ignore']
		}
	);
	const finished = once(child, 'close');
	try {
		const [started] = await Promise.race([once(child.stdout, 'data'), finished]);
		expect(String(started)).toContain('listening');
		const ticket = requestSignup(launch, env, files);
		expect(ticket.status).toBe('requested');
		const client = new VaultBrokerClientAdapter({ socketPath });
		await approveSignup(client, run, ticket);
		const invoke = () =>
			JSON.parse(
				execFileSync('bun', [...launch, 'generate-password', ticket.requestId], {
					env: { ...env, HARNESS_VAULT_RECEIPT: ticket.receipt },
					encoding: 'utf8',
					stdio: ['ignore', 'pipe', 'ignore']
				})
			);
		expect(invoke()).toEqual({ status: 'completed' });
		expect(invoke()).toEqual({ status: 'completed' });
		expect(readdirSync(join(state, 'password-browsers'))).toEqual([]);
	} finally {
		child.kill('SIGTERM');
		await finished;
	}
}

function signupBrokerFiles(run: ReturnType<typeof vaultBroker>, settings: object) {
	const { input, review, reviewers, script } = signupFixtureRecipe();
	const write = (name: string, value: unknown) => {
		const file = join(run.state, name);
		writeFileSync(file, Buffer.isBuffer(value) ? value : JSON.stringify(value), { mode: 0o600 });
		return file;
	};
	const scope = { project: 'harness', environment: 'synthetic', host: 'mb2' };
	const entry = {
		scope,
		recipe: write('recipe', input),
		review: write('review', review),
		script: write('script', script)
	};
	const pins = write('pins', { reviewers });
	const config = write('config', { ...settings, entries: [entry], reviewers: pins });
	const trust = write('trust', {
		devices: [{ id: run.phone.deviceId, role: 'approver', signingKey: run.phone.signingKey }]
	});
	return { scope, entry, config, trust, pins };
}

function requestSignup(
	launch: string[],
	env: typeof process.env,
	files: ReturnType<typeof signupBrokerFiles>
) {
	const request = execFileSync(
		'bun',
		[
			...launch,
			'request',
			files.entry.recipe,
			'generate-password',
			'--review',
			files.entry.review,
			'--reviewers',
			files.pins,
			'--item',
			'bswrwa',
			'--session',
			'fixture-session',
			'--project',
			files.scope.project,
			'--environment',
			files.scope.environment,
			'--host',
			files.scope.host,
			'--reason',
			'Synthetic signup test.'
		],
		{ env, encoding: 'utf8' }
	);
	return JSON.parse(request);
}

async function approveSignup(
	client: VaultBrokerClientAdapter,
	run: ReturnType<typeof vaultBroker>,
	ticket: Parameters<typeof approval>[1]
) {
	const challenge = () =>
		client.call<{ nonce: string }>('/v1/device/challenge', { deviceId: run.phone.deviceId });
	const offer = await challenge();
	const [request] = await client.call<VaultQueueEntry[]>(
		'/v1/device/requests',
		run.phone.prove(origin, '/v1/device/requests', offer.nonce)
	);
	const binding: VaultSessionRequest = request;
	const { nonce } = await challenge();
	const decision: VaultApproval = {
		...approval(binding, ticket, run),
		sealed: null,
		otpIncluded: false,
		expiresAt: Date.now() + 25_000,
		project: request.project,
		environment: request.environment
	};
	const signed = run.phone.decide(origin, nonce, decision, {
		...binding,
		recipeDigest: binding.recipe.digest,
		runnerFingerprint: ticket.runnerFingerprint
	});
	expect(await client.call('/v1/device/decision', signed)).toEqual({ status: 'approved' });
}
