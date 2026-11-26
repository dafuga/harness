import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { inPlaceLaunch, inPlaceRun } from '../../support/trackerInPlaceFixture';
import { withTempDir, withTempRepo } from '../../support/temporary';

test('runs a non-git project in place and verifies it there', () =>
	withTempDir('hnt-nogit-', async (root) => {
		const { launcher, input, source, state } = inPlaceLaunch(root);
		expect(await launcher.start(input, AbortSignal.timeout(20_000))).toMatchObject({
			status: 'started'
		});
		const check = await launcher.verify!(inPlaceRun(input), 'pwd -P', AbortSignal.timeout(20_000));
		expect(check).toEqual({ code: 0, output: `${realpathSync(source)}\n` });
		expect(existsSync(join(state(), 'worktree'))).toBe(false);
	}));

test('honors a worktree opt-out for a git checkout and keeps worktrees by default', () =>
	withTempRepo(async ({ root, git }) => {
		git('commit', '--allow-empty', '-m', 'Fixture source');
		const { launcher, input, source } = inPlaceLaunch(root, { git: root });
		await launcher.start({ ...input, worktree: false }, AbortSignal.timeout(20_000));
		const check = await launcher.verify!(inPlaceRun(input), 'pwd -P', AbortSignal.timeout(20_000));
		expect(check).toEqual({ code: 0, output: `${realpathSync(source)}\n` });
		expect(git('worktree', 'list').split('\n')).toHaveLength(1);
	}));

test('refuses to run in place when git cannot create the worktree', () =>
	withTempDir('hnt-broken-', async (root) => {
		const { launcher, input, source } = inPlaceLaunch(root);
		// A repository without a commit: it is git, so a failed worktree must not fall back.
		mkdirSync(join(source, '.git'), { recursive: true });
		writeFileSync(join(source, '.git', 'HEAD'), 'ref: refs/heads/main\n');
		for (const name of ['objects', 'refs']) mkdirSync(join(source, '.git', name));
		expect(await launcher.start(input, AbortSignal.timeout(20_000))).toEqual({
			status: 'rejected'
		});
	}));

test('keeps Docker workers out of an in-place directory', () =>
	withTempDir('hnt-docker-', async (root) => {
		const { launcher, input } = inPlaceLaunch(root);
		const docker = { ...input, backend: 'docker' as const, platform: 'linux' as const };
		expect(await launcher.start(docker, AbortSignal.timeout(20_000))).toEqual({
			status: 'rejected'
		});
	}));
