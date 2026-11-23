import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { loadTrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import type { TrackerHostStartRequest } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import {
	fixtureDockerImage as image,
	managedFixtureBindings
} from '../../support/trackerManagedProcessFixture';
import { withTempRepo } from '../../support/temporary';
import type { TemporaryRepo } from '../../support/temporary.types';
import { measureWorkload } from '../../support/measureWorkload';

const node = 'daniel-primary-mbp';
const signal = new AbortController().signal;
const client = { node, role: 'hub' as const, apiPort: 49281, syncPort: 49282 };

test('launches native and managed Docker workers through isolated tmux and reuses their durable attempt evidence', () =>
	measureWorkload('adapter.projects-sessions-tracker-tmux', 'managed-worker-roundtrip', () =>
		withTempRepo(proveManagedWorker)
	));

async function proveManagedWorker({ root, git }: TemporaryRepo) {
	git('commit', '--allow-empty', '-m', 'Fixture source');
	const paths = managedFixtureBindings(root);
	const managed = loadManagedFixture(root, paths.config);
	const { trackerManagedHostLauncher } =
		await import('../../../src/adapters/projects-sessions/tracker-tmux-adapter/trackerManagedHostLauncher');
	const scoped = {
		...client,
		writeGuestAuth: ({ path }: { path: string }) =>
			writeFileSync(path, 'synthetic', { flag: 'wx', mode: 0o600 })
	};
	const launcher = trackerManagedHostLauncher(managed, { client: scoped, platform: 'darwin' });
	const docker = launchInput(root, 1, 'docker');
	const native = launchInput(root, 2, 'native');
	const claude = launchInput(root, 3, 'native');
	for (const input of [docker, native, claude]) {
		expect(await launcher.start(input, signal)).toMatchObject({
			status: 'started',
			session: { key: input.key, state: 'exited', exitCode: 0 }
		});
	}
	const restarted = trackerManagedHostLauncher(managed, { client: scoped, platform: 'darwin' });
	const replies = await restarted.inspect(
		{ node, keys: [docker.key, native.key, 'wrong'] },
		signal
	);
	expect(replies.map(({ key, state, exitCode }) => ({ key, state, exitCode }))).toEqual([
		{ key: docker.key, state: 'exited', exitCode: 0 },
		{ key: native.key, state: 'exited', exitCode: 0 }
	]);
	await restarted.start(docker, signal);
	verifyWorkerInvocations(paths.profiles);
	expect(
		await trackerManagedHostLauncher(managed, { client, platform: 'linux' }).start(native, signal)
	).toEqual({
		status: 'rejected'
	});
}

function loadManagedFixture(
	root: string,
	managed: ReturnType<typeof managedFixtureBindings>['config']
) {
	const path = join(root, 'foreground.json');
	writeFileSync(
		path,
		JSON.stringify({
			...client,
			version: 1,
			database: join(root, 'fixture-db'),
			legacyFenceFile: join(root, 'fence'),
			syncSecretFile: join(root, 'secret'),
			hostEffects: { mode: 'active', checkpoint: 'fixture', launch: { managed, repositories: {} } }
		}),
		{ mode: 0o600 }
	);
	const effects = loadTrackerNodeConfig(path).hostEffects;
	if (effects?.mode !== 'active' || !effects.launch || !('managed' in effects.launch))
		throw new TypeError('Invalid managed fixture');
	return effects.launch.managed;
}

function launchInput(
	repo: string,
	runId: number,
	backend: 'native' | 'docker'
): TrackerHostStartRequest {
	const itemId = ['abc123def4', 'def123abc4', 'abc456def4'][runId - 1];
	const brief =
		'# Fixture\n' +
		(backend === 'docker' ? 'note '.repeat(5000) : '') +
		'\n## Completion and worktree cleanup\nFirst run tracker done.';
	return {
		node,
		runId,
		itemId,
		backend,
		repo,
		brief,
		key: JSON.stringify([itemId, 'reserved-fixture', 1]),
		platform: backend === 'docker' ? 'linux' : 'macos',
		queuedAt: Date.now() - 1000,
		selection:
			runId === 3
				? { provider: 'claude', model: 'claude-opus-5-5', intelligence: 'high' }
				: { provider: 'codex', model: 'gpt-6.2-sol', intelligence: 'high' }
	};
}

function verifyWorkerInvocations(profiles: { native: string; docker: string }) {
	const read = (profile: string) =>
		readFileSync(join(profile, 'invoked.ndjson'), 'utf8')
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
	const docker = read(profiles.docker);
	const native = read(profiles.native);
	expect(docker).toHaveLength(1);
	expect(native).toHaveLength(2);
	verifySecretSafety(profiles, [docker[0].brief, ...native.map(({ brief }) => brief)]);
	expect(docker[0]).toMatchObject({
		argv: [
			'task',
			'orchestrate',
			'--platform',
			'linux',
			'--tracker',
			'abc123def4',
			'--brief',
			expect.stringContaining('/brief.md'),
			'--model',
			'gpt-6.2-sol',
			'--intelligence',
			'high'
		],
		image,
		secret: false,
		brief: expect.stringContaining('First run tracker done.')
	});
	expect(Buffer.byteLength(docker[0].brief)).toBeLessThan(16_000);
	expect(native[0]).toMatchObject({
		argv: [
			'--sandbox',
			'workspace-write',
			'-m',
			'gpt-6.2-sol',
			'-c',
			'model_reasoning_effort="high"',
			expect.stringContaining('def123abc4')
		],
		image: null,
		secret: false,
		client: { node, apiPort: client.apiPort },
		legacy: '/dev/null/tracker',
		guestAuthFile: null
	});
	expect(docker[0].cwd).toMatch(/\/effects\/[a-f0-9]{64}\/worktree$/);
	expect(native[0].cwd).not.toBe(docker[0].cwd);
}

function verifySecretSafety(profiles: { native: string; docker: string }, briefs: string[]) {
	const skill = 'skills/secret-safe-computer-use/SKILL.md';
	const home = profiles.native;
	const install = spawnSync('/bin/sh', ['deploy/vault/install-secret-safe-skill.sh'], {
		env: { PATH: process.env.PATH, HOME: home }
	});
	expect(install.status).toBe(0);
	const codex = readFileSync(join(home, '.codex', skill), 'utf8');
	expect(readFileSync(join(home, '.claude', skill), 'utf8')).toBe(codex);
	const rule = codex.split('---\n')[2].trim();
	for (const brief of briefs) {
		expect(brief.startsWith(rule + '\n\n')).toBe(true);
		expect(brief.split(rule)).toHaveLength(2);
	}
}
