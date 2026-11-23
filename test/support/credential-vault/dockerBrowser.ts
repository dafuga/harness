import { execFileSync } from 'node:child_process';
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
import type { VaultApproval } from '../../../src/validators/accounts-access/VaultWireValidator.types';
import { approval, sessionRequest, sign, vaultBroker } from './broker';
import type { VaultTestRequester } from './crossUserCdp.types';
import { syntheticExecutor } from './executor';
import { canary } from './phone';
import { verifyFixtureSandbox } from './privateBrowser';
import { signedFixtureRecipe } from './recipe';

export const approved = 'https://console.example.test';
export const denied = 'https://outside.example.test';
const context = process.env.HARNESS_TEST_VAULT_DOCKER_CONTEXT;

export async function browserFixture(
	image: string,
	network: VaultBrowserDockerLaunch['network'],
	capture = false,
	requester?: VaultTestRequester
) {
	const fixture = vaultBroker(requester?.runDirectory);
	const { recipe, script } = signedFixtureRecipe(capture);
	const docker = new VaultBrowserDockerAdapter({
		image,
		context,
		seccomp: join(process.cwd(), 'deploy/vault/seccomp.json'),
		journal: join(fixture.state, 'docker')
	});
	const server = await serveFixture(fixture, requester?.uid);
	let guest: VaultBrowserDockerSession | undefined;
	const close = () => closeBrowserFixture(guest, server.close);
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
		const { ticket, approved } = approveFixture(fixture, input, created, server.requestUid);
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

async function closeBrowserFixture(
	guest: VaultBrowserDockerSession | undefined,
	close: () => Promise<void>
) {
	try {
		await guest?.close();
	} finally {
		await close();
	}
}

async function serveFixture(fixture: ReturnType<typeof vaultBroker>, requester?: number) {
	const binary = join(fixture.state, 'peer.node');
	execFileSync('bash', ['deploy/vault/build-peer.sh', binary]);
	const peer = new VaultPeerAdapter({ binary });
	const uid = process.getuid?.();
	if (uid === undefined) throw new Error('The fixture needs a Unix user.');
	const requestUid = requester ?? uid;
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
			uid: requestUid,
			issuedAt,
			expiresAt: issuedAt + 120_000
		});
		// The frozen cross-user fixture uses a private executor call for admission. Its separate
		// requester proves the kernel identity at the CDP relay, not at this owner-only socket.
		if (requestUid !== uid) {
			return fixture.broker.create(input, requestUid, preflight.verify(input, requestUid, proof));
		}
		return client.call<VaultCreated>('/v1/session/requests', { ...input, preflight: proof });
	};
	return { peer, uid, requestUid, client, submit, close: () => server.close() };
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
