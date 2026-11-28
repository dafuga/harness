import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { prepareTaskWorkspace } from '../../../src/services/agents-providers/module-task-worker-service/taskWorkspace';
import { createTempDirectory } from '../../support/temporary';

let base: string;
beforeEach(async () => {
	base = await createTempDirectory('task-workspace-');
});
afterEach(() => {
	rmSync(base, { recursive: true, force: true });
});

/** A checkout with installed packages, a linked workspace package and a stray file. */
function fixture() {
	const root = join(base, 'root'),
		worktree = join(base, 'worktree'),
		modules = join(root, 'node_modules');
	for (const name of ['vitest', '@scope/tool', '.bin'])
		mkdirSync(join(modules, name), { recursive: true });
	mkdirSync(join(root, 'packages', 'local'), { recursive: true });
	symlinkSync(join(root, 'packages', 'local'), join(modules, 'local'), 'dir');
	writeFileSync(join(modules, '.package-lock.json'), '{}\n');
	mkdirSync(worktree);
	return { root, worktree, modules, target: join(worktree, 'node_modules') };
}

test('the worktree gets its own node_modules folder linking each installed package', async () => {
	const { root, worktree, modules, target } = fixture();
	await prepareTaskWorkspace(root, worktree);
	expect(lstatSync(target).isDirectory()).toBe(true);
	expect(lstatSync(target).isSymbolicLink()).toBe(false);
	expect(readdirSync(target).sort()).toEqual(['.bin', '@scope', 'local', 'vitest']);
	for (const name of ['.bin', '@scope', 'local', 'vitest']) {
		expect(lstatSync(join(target, name)).isSymbolicLink()).toBe(true);
		expect(realpathSync(join(target, name))).toBe(realpathSync(join(modules, name)));
	}
	expect(realpathSync(join(target, '@scope', 'tool'))).toBe(
		realpathSync(join(modules, '@scope', 'tool'))
	);
	expect(realpathSync(join(target, 'local'))).toBe(realpathSync(join(root, 'packages', 'local')));
});

test('plain files in the shared node_modules are not linked', async () => {
	const { root, worktree, target } = fixture();
	await prepareTaskWorkspace(root, worktree);
	expect(existsSync(join(target, '.package-lock.json'))).toBe(false);
});

test('tool caches written under the worktree node_modules stay in the worktree', async () => {
	const { root, worktree, modules, target } = fixture();
	await prepareTaskWorkspace(root, worktree);
	mkdirSync(join(target, '.vite-temp'));
	writeFileSync(join(target, '.vite-temp', 'config.mjs'), 'export default {};\n');
	expect(existsSync(join(modules, '.vite-temp'))).toBe(false);
	expect(readdirSync(modules).sort()).toEqual([
		'.bin',
		'.package-lock.json',
		'@scope',
		'local',
		'vitest'
	]);
});

test('an existing worktree node_modules is left untouched', async () => {
	const { root, worktree, target } = fixture();
	mkdirSync(target);
	writeFileSync(join(target, 'keep.txt'), 'mine\n');
	await prepareTaskWorkspace(root, worktree);
	expect(readdirSync(target)).toEqual(['keep.txt']);
	rmSync(target, { recursive: true });
	symlinkSync(join(root, 'node_modules'), target, 'dir');
	await prepareTaskWorkspace(root, worktree);
	expect(lstatSync(target).isSymbolicLink()).toBe(true);
});

test('a checkout without installed packages leaves the worktree without node_modules', async () => {
	const { root, worktree, modules, target } = fixture();
	rmSync(modules, { recursive: true });
	await prepareTaskWorkspace(root, worktree);
	expect(existsSync(target)).toBe(false);
	expect(existsSync(join(root, 'node_modules'))).toBe(false);
});
