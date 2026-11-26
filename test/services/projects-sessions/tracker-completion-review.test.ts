import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { expect } from '../../verificationExpect';
import { loadTrackerNodeConfig } from '../../../src/services/projects-sessions/tracker-node-service/trackerNodeConfig';
import { measureWorkload } from '../../support/measureWorkload';
import { withTempDir, withTempRepo } from '../../support/temporary';
import {
	completionReviewFixture,
	markReviewDone,
	reviewItem,
	startReviewRun,
	tickUntil
} from '../../support/trackerCompletionReviewFixture';

vi.setConfig({ testTimeout: 40_000 });

/** Passes once `<repo>/pass` exists; proves the worktree, clean environment and output tail. */
const suite = (root: string) =>
	`test -z "$FIXTURE_SECRET" || exit 9; basename "$PWD" >> ${root}/ran; echo fixture-suite-output; test -f ${root}/pass`;

test('a failing verify command reopens the item with its output and retries; a passing one records done', () =>
	measureWorkload(
		'service.projects-sessions-tracker-native-runtime',
		'post-done-verification',
		() =>
			withTempRepo(async (repo) => {
				vi.stubEnv('FIXTURE_SECRET', 'synthetic');
				const fixture = completionReviewFixture(repo, suite(repo.root));
				await startReviewRun(fixture);
				expect(fixture.runs()[0].source_repo).toBe(repo.root);
				markReviewDone(fixture);
				await tickUntil(fixture.tick, () => expect(fixture.runs()[0].outcome).toBe('failed'));
				expect(fixture.runs()[0].failure_reason).toMatch(/^tests failed: .* exited 1$/);
				expect(fixture.item().status).toBe('open');
				expect(fixture.notes()).toContain('tests failed after done');
				expect(fixture.notes()).toContain('fixture-suite-output');
				expect(fixture.read('ran')).toBe('worktree\n');

				fixture.touch('pass');
				await tickUntil(fixture.tick, () => expect(fixture.runs()[1]?.state).toBe('running'));
				markReviewDone(fixture);
				await tickUntil(fixture.tick, () => expect(fixture.runs()[1].outcome).toBe('done'));
				expect(fixture.item().status).toBe('done');
				expect(fixture.runs()[0].redone_by).toBe(fixture.runs()[1].rung);
				vi.unstubAllEnvs();
			})
	));

/** Leaves a nested child behind each attempt, so cleanup has a process tree to stop. */
const slowSuite = (root: string) =>
	`sleep 60 & echo $! >> ${root}/children; while [ ! -f ${root}/pass ]; do sleep 0.05; done`;
const children = (text: string) => text.trim().split('\n').filter(Boolean).map(Number);
const alive = (pid: number) => {
	try {
		return process.kill(pid, 0);
	} catch {
		return false;
	}
};

test('a restart re-runs an interrupted verify, and shutdown stops its whole process tree', () =>
	withTempRepo(async (repo) => {
		const fixture = completionReviewFixture(repo, slowSuite(repo.root));
		await startReviewRun(fixture);
		markReviewDone(fixture);
		await tickUntil(fixture.tick, () => expect(children(fixture.read('children'))).toHaveLength(1));
		await fixture.tick();
		expect(fixture.runs()[0].state).toBe('verifying');
		expect(children(fixture.read('children'))).toHaveLength(1);
		fixture.stop();
		const [first] = children(fixture.read('children'));
		await vi.waitFor(() => expect(alive(first)).toBe(false));

		const restarted = fixture.boot();
		await tickUntil(restarted.tick, () =>
			expect(children(fixture.read('children'))).toHaveLength(2)
		);
		fixture.touch('pass');
		await tickUntil(restarted.tick, () => expect(fixture.runs()[0].outcome).toBe('done'));
	}));

test('reopening during verification stops the command and returns the run to its session', () =>
	withTempRepo(async (repo) => {
		const fixture = completionReviewFixture(repo, slowSuite(repo.root));
		await startReviewRun(fixture);
		markReviewDone(fixture);
		await tickUntil(fixture.tick, () => expect(children(fixture.read('children'))).toHaveLength(1));
		fixture.runtime.store.appendLocal({ itemId: reviewItem, fields: { status: 'open' } });
		const [child] = children(fixture.read('children'));
		await tickUntil(fixture.tick, () => expect(alive(child)).toBe(false));
		expect(fixture.runs()[0].state).not.toBe('verifying');
	}));

test('a verify command is accepted only for macOS routes of the managed launcher', () =>
	withTempDir('tracker-verify-config-', (root) => {
		const load = (launch: object) => {
			const path = join(root, 'foreground.json');
			const base = JSON.parse(readFileSync(path, 'utf8'));
			base.hostEffects.launch = launch;
			writeFileSync(path, JSON.stringify(base));
			return loadTrackerNodeConfig(path);
		};
		writeFileSync(
			join(root, 'foreground.json'),
			JSON.stringify({
				version: 1,
				node: 'daniel-primary-mbp',
				role: 'hub',
				apiPort: 49281,
				syncPort: 49282,
				database: join(root, 'db'),
				legacyFenceFile: join(root, 'fence'),
				syncSecretFile: join(root, 'secret'),
				hostEffects: { mode: 'active', checkpoint: 'fixture' }
			}),
			{ mode: 0o600 }
		);
		const managed = {
			tmux: '/bin/sh',
			stateDirectory: root,
			trackerBinDirectory: root,
			native: { codex: '/bin/sh', claude: '/bin/sh', profile: root }
		};
		const route = { repo: root, platform: 'macos', verify: 'bun run check' };
		expect(() => load({ managed, repositories: { harness: route } })).not.toThrow();
		expect(() =>
			load({ managed, repositories: { harness: { ...route, platform: 'linux' } } })
		).toThrow();
		expect(() => load({ driver: '/bin/sh', repositories: { harness: route } })).toThrow();
		expect(() =>
			load({ managed, repositories: { harness: route, alias: { ...route, verify: 'true' } } })
		).toThrow();
	}));
