import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { HookInstallService } from '../../src/services/hook-install-service/HookInstallService';
import { legacyPrePush } from '../support/legacyHooks';

// Two worktrees of one repository share its hooks directory; each keeps its opt-ins in its own
// Git directory, one file for each stage it asked for.
let parent: string;
const identity = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@harness.invalid'];
const git = (cwd: string, ...args: string[]) =>
	execFileSync('git', [...identity, '-c', 'commit.gpgsign=false', ...args], { cwd }).toString();
const main = () => join(parent, 'main');
const second = () => join(parent, 'second');
const own = (...path: string[]) => join(main(), '.git', ...path);
const others = (...path: string[]) => join(main(), '.git/worktrees/second', ...path);
const hook = (stage: string) => own('hooks', stage);
const service = (root: string) => new HookInstallService(root);
const enabled = async (root: string) =>
	(await service(root).status()).stages.map((item) => item.enabled);
const read = (file: string) => readFileSync(file, 'utf8');

beforeEach(() => {
	parent = mkdtempSync(join(tmpdir(), 'harness-hook-install-'));
	git(parent, 'init', '-q', '-b', 'main', 'main');
	git(main(), 'commit', '-q', '--allow-empty', '-m', 'chore: start');
	git(main(), 'worktree', 'add', '-q', '-b', 'second', second());
});
afterEach(() => rmSync(parent, { recursive: true, force: true }));

test('install opts this worktree into each stage with a file of its own, and no other worktree', async () => {
	const status = await service(main()).install(' harness ');
	expect([read(own('harness-hooks')), read(own('harness-hooks-commit-msg'))]).toEqual([
		'harness\n',
		'harness\n'
	]);
	expect([status.installed, status.enabled, status.stage]).toEqual([true, true, 'pre-push']);
	expect(await enabled(main())).toEqual([true, true]);
	// The wrappers are shared, the opt-ins are not: the other worktree is asked nothing.
	const other = await service(second()).status();
	expect(other.stages.map((item) => item.installed)).toEqual([true, true]);
	expect([other.enabled, await enabled(second())]).toEqual([false, [false, false]]);
	expect([
		existsSync(others('harness-hooks')),
		existsSync(others('harness-hooks-commit-msg'))
	]).toEqual([false, false]);
});

test('a worktree with only the file of an earlier Harness is in the push stage and no other', async () => {
	// What `harness hooks install` left at b4afb74: its wrapper, and its one command file.
	writeFileSync(hook('pre-push'), legacyPrePush);
	chmodSync(hook('pre-push'), 0o755);
	writeFileSync(others('harness-hooks'), 'old-harness\n');
	const before = await service(second()).status();
	expect([before.installed, before.enabled, await enabled(second())]).toEqual([
		true,
		true,
		[true, false]
	]);
	// Another worktree adopts the later stage: the earlier one is still asked for pushes only.
	await service(main()).install('harness');
	expect([read(others('harness-hooks')), await enabled(second())]).toEqual([
		'old-harness\n',
		[true, false]
	]);
	expect(existsSync(others('harness-hooks-commit-msg'))).toBe(false);
	// It leaves again: the stage nobody else asked for goes, the push hook of the other stays.
	await service(main()).uninstall();
	expect([existsSync(hook('commit-msg')), read(hook('pre-push'))]).toEqual([false, legacyPrePush]);
	expect([existsSync(own('harness-hooks')), existsSync(own('harness-hooks-commit-msg'))]).toEqual([
		false,
		false
	]);
	expect(read(others('harness-hooks'))).toBe('old-harness\n');
	await service(second()).uninstall();
	expect([existsSync(hook('pre-push')), existsSync(others('harness-hooks'))]).toEqual([
		false,
		false
	]);
});

test('a stage stays installed for as long as any worktree asks for it', async () => {
	await service(main()).install('harness');
	await service(second()).install('harness');
	await service(main()).uninstall();
	expect([existsSync(hook('pre-push')), existsSync(hook('commit-msg'))]).toEqual([true, true]);
	expect([await enabled(main()), await enabled(second())]).toEqual([
		[false, false],
		[true, true]
	]);
	await service(second()).uninstall();
	expect([existsSync(hook('pre-push')), existsSync(hook('commit-msg'))]).toEqual([false, false]);
});
