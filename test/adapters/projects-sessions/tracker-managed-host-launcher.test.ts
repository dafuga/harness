import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import type * as Os from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { loadTrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import type { TrackerHostStartRequest } from '../../../src/services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import {
	fixtureDockerImage as image,
	managedFixtureBindings
} from '../../support/trackerManagedProcessFixture';
import {
	verifyClaudeRefusals,
	verifyUnusableWorktree
} from '../../support/trackerClaudeStartupFixture';
import {
	managedTrackerTools,
	verifyNativeInvocations,
	verifyTrackerCliUpgrade
} from '../../support/trackerNativeInvocationAssertions';
import { withTempRepo } from '../../support/temporary';
import type { TemporaryRepo } from '../../support/temporary.types';
import { measureWorkload } from '../../support/measureWorkload';

vi.mock('node:os', async (importOriginal) => {
	const os = await importOriginal<typeof Os>();
	return { ...os, userInfo: () => ({ ...os.userInfo(), username: 'unknown' }) };
});
const node = 'daniel-primary-mbp';
const signal = new AbortController().signal;
const client = { node, role: 'hub' as const, apiPort: 49281, syncPort: 49282 };
test(
	'launches native and managed Docker workers through isolated tmux and reuses their durable attempt evidence',
	{ timeout: 30_000 },
	() =>
		measureWorkload('adapter.projects-sessions-tracker-tmux', 'managed-worker-roundtrip', () =>
			withTempRepo(proveManagedWorker)
		)
);

async function proveManagedWorker({ root, git }: TemporaryRepo) {
	git('commit', '--allow-empty', '-m', 'Fixture source');
	const paths = managedFixtureBindings(root);
	const trackerBinDirectory = managedTrackerTools(root);
	const managed = loadManagedFixture(root, { ...paths.config, trackerBinDirectory });
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
	const claude = {
		...native,
		node: 'harbor-mbp-2',
		runId: 3,
		key: JSON.stringify([native.itemId, 'reserved-claude-fixture', 1]),
		selection: { provider: 'claude', model: 'claude-sonnet-4-6', intelligence: 'high' },
		sessionName: 'Harness: Fixture'
	} satisfies TrackerHostStartRequest;
	vi.stubEnv('HOME', paths.profiles.accountHome);
	vi.stubEnv('USER', 'untrusted-fixture-user');
	try {
		for (const input of [docker, native, claude]) {
			expect(await launcher.start(input, signal)).toMatchObject({
				status: 'started',
				session: { key: input.key, state: 'exited', exitCode: 0 }
			});
		}
		await verifyClaudeRefusals(launcher, claude, paths.profiles.accountHome);
		await verifyUnusableWorktree(launcher, native);
	} finally {
		vi.unstubAllEnvs();
	}
	verifyLaunchSockets(root);
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
	verifyTrackerCliUpgrade(trackerBinDirectory, paths.profiles.native);
	expect(
		await trackerManagedHostLauncher(managed, { client, platform: 'linux' }).start(native, signal)
	).toEqual({
		status: 'rejected'
	});
}

function verifyLaunchSockets(root: string) {
	expect(readFileSync(join(root, 'launch-sockets'), 'utf8').trim().split('\n')).toEqual([
		'default',
		'default',
		'tracker-claude-aqua',
		'tracker-claude-aqua'
	]);
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
	const itemId = ['abc123def4', 'def123abc4'][runId - 1];
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
		selection: { provider: 'codex', model: 'gpt-6.2-sol', intelligence: 'high' }
	};
}

function verifyWorkerInvocations(profiles: ReturnType<typeof managedFixtureBindings>['profiles']) {
	const read = (profile: string) =>
		readFileSync(join(profile, 'invoked.ndjson'), 'utf8')
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
	const docker = read(profiles.docker);
	const native = read(profiles.native);
	const claude = read(profiles.accountHome);
	expect(docker).toHaveLength(1);
	expect(native).toHaveLength(1);
	expect(claude).toHaveLength(1);
	verifySecretSafety(profiles, [docker[0].brief, native[0].brief, claude[0].brief]);
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
		user: null,
		secret: false,
		brief: expect.stringContaining('First run tracker done.')
	});
	expect(Buffer.byteLength(docker[0].brief)).toBeLessThan(16_000);
	expect(docker[0].cwd).toMatch(/\/effects\/[a-f0-9]{64}\/worktree$/);
	verifyNativeInvocations(native[0], claude[0], { dockerWorktree: docker[0].cwd, client });
}

function verifySecretSafety(profiles: { native: string; docker: string }, briefs: string[]) {
	const skill = 'skills/secret-safe-computer-use/SKILL.md';
	const install = spawnSync('/bin/bash', ['deploy/vault/install-secret-safe-skill.sh'], {
		env: { PATH: process.env.PATH, HOME: profiles.native }
	});
	expect(install.status).toBe(0);
	const codex = readFileSync(join(profiles.native, '.codex', skill), 'utf8');
	expect(readFileSync(join(profiles.native, '.claude', skill), 'utf8')).toBe(codex);
	const rule = codex.split('---\n')[2].trim();
	for (const brief of briefs) {
		expect(brief.startsWith(rule + '\n\n')).toBe(true);
		expect(brief.split(rule)).toHaveLength(2);
	}
}
