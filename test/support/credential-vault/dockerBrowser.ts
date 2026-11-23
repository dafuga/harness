import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { expect } from 'vitest';
import { VaultBrowserDockerAdapter } from '../../../src/adapters/accounts-access/VaultBrowserDockerAdapter';
import { VaultBrokerClientAdapter } from '../../../src/adapters/accounts-access/VaultBrokerClientAdapter';
import { VaultBrokerServerAdapter } from '../../../src/adapters/accounts-access/VaultBrokerServerAdapter';
import { VaultPeerAdapter } from '../../../src/adapters/accounts-access/VaultPeerAdapter';
import {
	dockerControl,
	dockerDaemon
} from '../../../src/adapters/agents-providers/managed-provider-docker-adapter/dockerControl';
import { vaultDockerLabel } from '../../../src/adapters/accounts-access/vault-browser-docker-adapter/browserDockerJournal';
import type { VaultCreated } from '../../../src/services/accounts-access/VaultBrokerService.types';
import type { VaultApproval } from '../../../src/validators/accounts-access/VaultWireValidator.types';
import { approval, sessionRequest, sign, vaultBroker } from './broker';
import type { VaultTestRequester } from './crossUserCdp.types';
import { canary } from './phone';
import { signedFixtureRecipe } from './recipe';

export const approved = 'https://console.example.test';
export const denied = 'https://outside.example.test';
const context = process.env.HARNESS_TEST_VAULT_DOCKER_CONTEXT;

export async function browserFixture(
	image: string,
	capture = false,
	requester?: VaultTestRequester
) {
	const fixture = vaultBroker(requester?.runDirectory);
	fixture.clock.now = Date.now();
	const { recipe, script } = signedFixtureRecipe(capture);
	const uid = process.getuid?.();
	if (uid === undefined) throw new Error('The fixture needs a Unix user.');
	const requestUid = requester?.uid ?? uid;
	const runner = fixture.seal.runnerKey();
	const input = sessionRequest(runner, {
		origins: [approved],
		...(capture && { action: 'capture-secret', mode: 'write' as const }),
		recipe: { site: recipe.recipe.site, revision: recipe.recipe.revision, digest: recipe.digest }
	});
	const docker = new VaultBrowserDockerAdapter({
		image,
		context,
		seccomp: join(process.cwd(), 'deploy/vault/seccomp.json'),
		journal: join(fixture.state, 'docker')
	});
	const { server, client, peer } = await serveFixtureBroker(fixture);
	try {
		const { ticket, approved } = await approveFixture(
			fixture,
			requester ? undefined : client,
			input,
			requestUid
		);
		return {
			...fixture,
			client,
			docker,
			input,
			uid,
			requestUid,
			peer,
			ticket,
			openSecret: () => runner.open(ticket.requestId, approved.sealed!),
			recipe,
			script,
			approved,
			close: () => server.close()
		};
	} catch (error) {
		await server.close();
		throw error;
	}
}

async function serveFixtureBroker(fixture: ReturnType<typeof vaultBroker>) {
	const binary = join(fixture.state, 'peer.node');
	execFileSync('bash', ['deploy/vault/build-peer.sh', binary]);
	const peer = new VaultPeerAdapter({ binary });
	const socketPath = join(fixture.state, 'broker', 'vault.sock');
	const server = new VaultBrokerServerAdapter({
		...fixture,
		socketPath,
		peerUid: (socket) => peer.uid(socket)
	});
	await server.listen();
	return { server, client: new VaultBrokerClientAdapter({ socketPath }), peer };
}

async function approveFixture(
	fixture: ReturnType<typeof vaultBroker>,
	client: VaultBrokerClientAdapter | undefined,
	input: ReturnType<typeof sessionRequest>,
	uid: number
) {
	const created = client
		? await client.call<VaultCreated>('/v1/session/requests', input)
		: fixture.broker.create(input, uid);
	const ticket = { requestId: created.requestId, receipt: created.receipt };
	const password = Buffer.from(JSON.stringify({ password: canary.password }));
	const sealed = fixture.phone.seal.seal(input.runnerPublicKey, ticket.requestId, password);
	password.fill(0);
	const decision = approval(input, created, fixture, { sealed, otpIncluded: false });
	const signed = sign(fixture, input, decision);
	if (client) await client.call('/v1/device/decision', signed);
	else fixture.broker.decide(signed);
	const proof = fixture.broker.claim(ticket, uid);
	const approved = JSON.parse(
		Buffer.from(proof.approval.payload, 'base64url').toString()
	) as VaultApproval;
	return { ticket, approved };
}

export async function withHttpsFixture(
	image: string,
	channel: 'sms' | 'email',
	use: (context: { id: string; ip: string; securityLog(): Promise<string> }) => Promise<void>,
	capture = false
) {
	const engine = await dockerDaemon(context);
	const docker = (args: string[]) => dockerControl(engine, args);
	const name = 'vault-jw0799-' + randomUUID();
	const label = `org.harness.vault-https-fixture=${name}`;
	const id = await docker(['network', 'create', '--internal', '--label', label, name]);
	const fixture = readFileSync('test/support/credential-vault/fixtureHttps.py', 'utf8');
	let site = '';
	try {
		site = await docker([
			'run',
			'-d',
			'--rm',
			'--pull=never',
			'--network=' + id,
			'--env=VAULT_FIXTURE_OTP=' + channel,
			...(capture ? ['--env=VAULT_CAPTURE=yes'] : []),
			'--label=' + label,
			'--entrypoint=/usr/bin/python3',
			image,
			'-c',
			fixture
		]);
		const format = '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}';
		const ip = await docker(['inspect', '--format', format, site]);
		await waitForHttps(docker, site);
		const readLog =
			'import ssl, urllib.request; print(urllib.request.urlopen("https://127.0.0.1/security-log", context=ssl._create_unverified_context()).read().decode())';
		await use({
			id,
			ip,
			securityLog: () => docker(['exec', site, '/usr/bin/python3', '-c', readLog])
		});
	} finally {
		if (site) await docker(['rm', '-f', site]);
		await docker(['network', 'rm', id]);
		expect(await docker(['ps', '-aq', '--filter', 'label=' + label])).toBe('');
		expect(await docker(['network', 'ls', '-q', '--filter', 'label=' + label])).toBe('');
	}
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

async function waitForHttps(
	docker: (args: string[]) => Promise<string>,
	site: string
): Promise<void> {
	const check = 'import socket; socket.create_connection(("127.0.0.1", 443), timeout=1).close()';
	for (let attempt = 0; attempt < 15; attempt++) {
		const ready = await docker(['exec', site, '/usr/bin/python3', '-c', check]).then(
			() => true,
			() => false
		);
		if (ready) return;
		await setTimeout(100);
	}
	throw new Error('Synthetic HTTPS fixture did not start.');
}
