import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { VaultBrowserDockerAdapter } from '../../../src/adapters/accounts-access/VaultBrowserDockerAdapter';
import type {
	VaultBrowserDockerLaunch,
	VaultBrowserDockerSession
} from '../../../src/adapters/accounts-access/VaultBrowserDockerAdapter.types';
import { VaultBrokerClientAdapter } from '../../../src/adapters/accounts-access/VaultBrokerClientAdapter';
import { VaultBrokerServerAdapter } from '../../../src/adapters/accounts-access/VaultBrokerServerAdapter';
import { VaultPeerAdapter } from '../../../src/adapters/accounts-access/VaultPeerAdapter';
import {
	dockerControl,
	dockerDaemon
} from '../../../src/adapters/agents-providers/managed-provider-docker-adapter/dockerControl';
import { vaultDockerLabel } from '../../../src/adapters/accounts-access/vault-browser-docker-adapter/browserDockerJournal';
import type { VaultCreated } from '../../../src/services/accounts-access/VaultBrokerService.types';
import { VaultRunnerPreflightService } from '../../../src/services/accounts-access/VaultRunnerPreflightService';
import { vaultRecipe } from '../../../src/utils/accounts-access/vaultRecipe';
import type { VaultRecipeInput } from '../../../src/utils/accounts-access/vaultRecipe.types';
import type { VaultApproval } from '../../../src/validators/accounts-access/VaultWireValidator.types';
import { approval, sessionRequest, sign, vaultBroker } from './broker';
import { syntheticExecutor } from './executor';
import { canary } from './phone';
import { verifyFixtureSandbox } from './privateBrowser';
import { reviewed } from './recipe';

export const approved = 'https://console.example.test';
export const denied = 'https://outside.example.test';
const context = process.env.HARNESS_TEST_VAULT_DOCKER_CONTEXT;

export async function browserFixture(
	image: string,
	network: VaultBrowserDockerLaunch['network'],
	capture = false
) {
	const fixture = vaultBroker();
	const { recipe, script } = signedFixtureRecipe(capture);
	const docker = new VaultBrowserDockerAdapter({
		image,
		context,
		seccomp: join(process.cwd(), 'deploy/vault/seccomp.json'),
		journal: join(fixture.state, 'docker')
	});
	const server = await serveFixture(fixture);
	let guest: VaultBrowserDockerSession | undefined;
	const close = async () => {
		try {
			await guest?.close();
		} finally {
			await server.close();
		}
	};
	try {
		guest = await docker.launch({
			origins: recipe.recipe.origins,
			redirects: recipe.recipe.redirects,
			network
		});
		await verifyFixtureSandbox(guest.pipe);
		fixture.clock.now = Date.now();
		const runner = fixture.seal.runnerKey();
		const input = sessionRequest(runner, {
			origins: recipe.recipe.origins,
			...(capture && { action: 'capture-secret', mode: 'write' as const }),
			recipe: { site: recipe.recipe.site, revision: recipe.recipe.revision, digest: recipe.digest }
		});
		const created = await server.submit(input);
		const { ticket, approved } = approveFixture(fixture, input, created, server.uid);
		return {
			...fixture,
			...server,
			guest,
			input,
			ticket,
			openSecret: () => runner.open(ticket.requestId, approved.sealed!),
			recipe,
			script,
			approved,
			close
		};
	} catch (error) {
		await close();
		throw error;
	}
}

async function serveFixture(fixture: ReturnType<typeof vaultBroker>) {
	const binary = join(fixture.state, 'peer.node');
	execFileSync('bash', ['deploy/vault/build-peer.sh', binary]);
	const peer = new VaultPeerAdapter({ binary });
	const uid = process.getuid?.();
	if (uid === undefined) throw new Error('The fixture needs a Unix user.');
	const executor = syntheticExecutor();
	const preflight = new VaultRunnerPreflightService([executor.pin], () => fixture.clock.now);
	const socketPath = join(fixture.state, 'broker', 'vault.sock');
	const server = new VaultBrokerServerAdapter({
		...fixture,
		preflight,
		socketPath,
		peerUid: (socket) => peer.uid(socket)
	});
	await server.listen();
	const client = new VaultBrokerClientAdapter({ socketPath });
	const submit = (input: ReturnType<typeof sessionRequest>) => {
		const issuedAt = fixture.clock.now;
		const proof = executor.attest(input, {
			brokerId: preflight.brokerId,
			uid,
			issuedAt,
			expiresAt: issuedAt + 120_000
		});
		return client.call<VaultCreated>('/v1/session/requests', { ...input, preflight: proof });
	};
	return { peer, uid, client, submit, close: () => server.close() };
}

function approveFixture(
	fixture: ReturnType<typeof vaultBroker>,
	input: ReturnType<typeof sessionRequest>,
	created: VaultCreated,
	uid: number
) {
	const ticket = { requestId: created.requestId, receipt: created.receipt };
	const password = Buffer.from(JSON.stringify({ password: canary.password }));
	const sealed = fixture.phone.seal.seal(input.runnerPublicKey, ticket.requestId, password);
	password.fill(0);
	const decision = approval(input, created, fixture, { sealed, otpIncluded: false });
	fixture.broker.decide(sign(fixture, input, decision));
	const proof = fixture.broker.claim(ticket, uid);
	const approved = JSON.parse(
		Buffer.from(proof.approval.payload, 'base64url').toString()
	) as VaultApproval;
	return { ticket, approved };
}

function signedFixtureRecipe(capture: boolean) {
	const input = JSON.parse(
		readFileSync('deploy/vault/recipes/example-console.json', 'utf8')
	) as VaultRecipeInput;
	const original = readFileSync('deploy/vault/recipes/example-console.browser.json');
	const script = capture ? captureRecipe(input, original) : original;
	const { review, reviewers } = reviewed(input, Date.now());
	return { recipe: vaultRecipe(input, review, reviewers), script };
}

function captureRecipe(input: VaultRecipeInput, original: Buffer): Buffer {
	const script = JSON.parse(original.toString());
	script.steps.at(-1).next = '/capture';
	script.capture = { trigger: '#generate', result: '/created', value: '#generated' };
	const program = Buffer.from(JSON.stringify(script));
	input.actions = [{ id: 'capture-secret', mode: 'write', start: '/capture' }];
	input.methods = [
		{
			kind: 'browser',
			actions: ['capture-secret'],
			reason: 'Synthetic browser capture action.',
			scriptSha256: createHash('sha256').update(program).digest('hex')
		}
	];
	return program;
}

export async function assertFixtureRemoved(owner: string): Promise<void> {
	const daemon = await dockerDaemon(context);
	expect(
		await dockerControl(daemon, ['ps', '-aq', '--filter', `label=${vaultDockerLabel}=${owner}`])
	).toBe('');
}

export async function assertFixtureIsolated(owner: string, ip: string): Promise<void> {
	const daemon = await dockerDaemon(context);
	const id = await dockerControl(daemon, [
		'ps',
		'-q',
		'--filter',
		`label=${vaultDockerLabel}=${owner}`
	]);
	expect(id).toMatch(/^[a-f0-9]{12,64}$/u);
	const config = await dockerControl(daemon, [
		'inspect',
		'--format',
		'{{.HostConfig.ReadonlyRootfs}} {{.HostConfig.Privileged}} {{json .NetworkSettings.Ports}}',
		id
	]);
	expect(config).toMatch(/^true false (\{\}|null)$/u);
	const connect = 'import socket, sys; socket.create_connection((sys.argv[1], 443), timeout=1)';
	await expect(
		dockerControl(daemon, ['exec', '-u', '10001:10001', id, '/usr/bin/python3', '-c', connect, ip])
	).rejects.toThrow();
}
