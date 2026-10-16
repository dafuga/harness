import { afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import * as planning from '../src/index';
const roots: string[] = [];
export const author = { kind: 'person' as const, name: 'Reviewer' };
export const contract = {
	responsibility: 'Filter values',
	inputs: [],
	outputs: [],
	errors: [],
	states: [],
	viewports: []
};
export const git = (root: string, ...args: string[]) =>
	execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
export async function fixture() {
	const root = await mkdtemp(join(tmpdir(), 'planning-'));
	roots.push(root);
	git(root, 'init', '-b', 'main');
	git(root, 'lfs', 'install', '--local');
	git(root, 'config', 'user.name', 'Test');
	git(root, 'config', 'user.email', 'test@example.invalid');
	await writeFile(join(root, 'readme'), 'initial');
	git(root, 'add', '.');
	git(root, 'commit', '-m', 'initial');
	return { root, api: await planning.createPlanning(root) };
}
