import { createHash, generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	canonical,
	hash,
	type Environment,
	type Journal,
	type Release
} from '../../../src/core/execution-runtimes/scripted-deploy/contracts';
import { signoffScope } from '../../../src/core/execution-runtimes/scripted-deploy/proofs';
import { DeployRunRepository } from '../../../src/repositories/execution-runtimes/DeployRunRepository';
import { createTempDirectory } from '../temporary';
import {
	manifestDigest,
	type DeployProject,
	type DeployRegistry
} from '../../../src/validators/execution-runtimes/DeployManifestValidator';

const phases = ['build', 'inspect', 'deploy', 'smoke', 'rollback', 'cleanup'] as const;
const targets = ['staging', 'preprod', 'prod'] as const;
const source = 'a'.repeat(40);
const profile = {
	bindings: { DB: 'd1:fixture' },
	secretNames: ['SERVICE_TOKEN'],
	migrations: [],
	runtimes: { node: 'v24' },
	flags: {}
};
const artifact = 'candidate fixture artifact';

export async function deployFixture() {
	const root = await createTempDirectory('harness-deploy-');
	const project = fixtureProject(root);
	const { registry, reviewer } = fixtureRegistry(root, project);
	const file = join(root, 'registry.json');
	write(file, registry);
	const store = new DeployRunRepository(registry.state);
	const release = fixtureArtifact(store, project);
	return {
		root,
		registry,
		project,
		release,
		store,
		run: (...args: string[]) => cli(root, file, args),
		mode: (value: string) => write(join(root, 'mode.json'), value),
		promote: (target: Environment, from?: string) => promote(root, file, target, release.id, from),
		review: (record: Journal) => review(root, file, reviewer, record),
		signoffProof: (record: Journal) => signoffProof(reviewer, record),
		operations: () =>
			readFileSync(join(root, 'operations.log'), 'utf8').trim().split('\n').filter(Boolean),
		dispose: () => rmSync(root, { recursive: true, force: true })
	};
}

function fixtureProject(root: string): DeployProject {
	mkdirSync(join(root, 'scripts'));
	const scripts = Object.fromEntries(
		phases.map((phase) => {
			const path = 'scripts/' + phase + '.sh';
			writeFileSync(join(root, path), '# ' + phase);
			return [phase, path];
		})
	) as DeployProject['scripts'];
	const targetConfig = (target: Environment) => ({
		id: target,
		route: 'https://' + target + '.fixture.test',
		profile
	});
	const projectTargets = {
		staging: targetConfig('staging'),
		preprod: targetConfig('preprod'),
		prod: targetConfig('prod')
	};
	const provider = Object.fromEntries(
		targets.map((target) => [
			target,
			{ target, profile, version: 'initial-' + target, source: 'b'.repeat(40), artifact: null }
		])
	);
	write(join(root, 'provider.json'), provider);
	write(join(root, 'mode.json'), 'normal');
	writeFileSync(join(root, 'operations.log'), '');
	return {
		root,
		checkout: root,
		repository: 'https://github.com/dafuga/fixture.git',
		sourceRef: 'refs/heads/dev',
		image: 'sha256:' + '1'.repeat(64),
		scripts,
		item: 'fixture-item',
		targets: projectTargets,
		differences: {},
		toolchain: { node: 'v24', bun: '1', wrangler: '4', gcloud: '594' }
	};
}

function fixtureRegistry(root: string, project: DeployProject) {
	for (const file of ['broker', 'docker']) {
		writeFileSync(join(root, file), readFileSync(join(import.meta.dirname, file + '.fixture')), {
			mode: 0o700
		});
	}
	const [stage, daniel, review] = ['stage', 'daniel', 'review'].map((id) => {
		const pair = generateKeyPairSync('ed25519');
		write(join(root, id + '.json'), pair.privateKey.export({ format: 'pem', type: 'pkcs8' }));
		return {
			id,
			publicKey: pair.publicKey.export({ format: 'pem', type: 'spki' }).toString(),
			privateKey: pair.privateKey
		};
	});
	const registry: DeployRegistry = {
		schema: 1,
		state: join(root, 'state'),
		broker: join(root, 'broker'),
		tracker: '/usr/bin/true',
		stageAuthority: publicIssuer(stage),
		daniel: publicIssuer(daniel),
		reviewers: [publicIssuer(review)],
		projects: { fixture: project }
	};
	return { registry, reviewer: review.privateKey };
}

function publicIssuer({ id, publicKey }: { id: string; publicKey: string }) {
	return { id, publicKey };
}

function fixtureArtifact(store: DeployRunRepository, project: DeployProject): Release {
	const body = {
		project: 'fixture',
		source,
		image: project.image,
		manifest: manifestDigest(project),
		size: Buffer.byteLength(artifact),
		migrations: [],
		artifact: createHash('sha256').update(artifact).digest('hex')
	};
	const release = { id: hash(body), ...body };
	mkdirSync(store.releaseDirectory(release.id), { recursive: true });
	write(join(store.releaseDirectory(release.id), 'release.json'), release);
	writeFileSync(store.artifact(release.id), artifact);
	return release;
}

function review(root: string, file: string, reviewer: KeyObject, record: Journal): Journal {
	const receipt = join(root, 'signoff.json');
	write(receipt, signoffProof(reviewer, record));
	return cli(root, file, ['signoff', record.plan.id, '--receipt', receipt]) as Journal;
}

function signoffProof(reviewer: KeyObject, record: Journal) {
	const now = Date.now();
	const payload = {
		issuer: 'review',
		kind: 'signoff' as const,
		scope: signoffScope(record),
		issuedAt: now,
		expiresAt: now + 200_000,
		reference: 'review:' + record.plan.id
	};
	return {
		payload,
		signature: sign(null, Buffer.from(canonical(payload)), reviewer).toString('base64url')
	};
}

function promote(
	...[root, file, target, id, from]: [string, string, Environment, string, string?]
): Journal {
	return cli(root, file, [
		'fixture',
		target,
		'--release',
		id,
		...(from ? ['--from', from] : [])
	]) as Journal;
}

function cli(root: string, file: string, args: string[]): unknown {
	const output = execFileSync(
		'bun',
		[join(import.meta.dirname, '../../../src/cli/index.ts'), 'deploy', '--registry', file, ...args],
		{
			env: { ...process.env, HARNESS_ANALYTICS_DISABLED: '1', PATH: root + ':' + process.env.PATH },
			stdio: ['ignore', 'pipe', 'pipe'],
			encoding: 'utf8'
		}
	);
	return JSON.parse(output) as unknown;
}

function write(file: string, value: unknown): void {
	writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
}
