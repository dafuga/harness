import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { WorkingTreeAdapter } from '../../src/adapters/git-source-history/WorkingTreeAdapter';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

test('list returns sorted paths and blob hashes for tracked and untracked files', async () => {
	await withTempRepo(async ({ root, git }) => {
		mkdirSync(join(root, 'src'));
		writeFileSync(join(root, 'README.md'), 'hello\n');
		writeFileSync(join(root, 'src', 'entry.ts'), 'export {};\n');
		git('add', 'README.md');
		const adapter = new WorkingTreeAdapter(root);
		const entries = await adapter.list();
		expect(entries.map(({ path }) => path)).toEqual(['README.md', 'src/entry.ts']);
		expect(entries[0]?.hash).toMatch(/^[a-f0-9]{40}$/);
		recordExampleCases(
			{
				unitId: 'adapter.working-tree',
				symbol: 'WorkingTreeAdapter.list',
				state: 'list-returns-sorted-paths-and-blob-hashes-for-tracked-and-un',
				evidence: 'examples-cases',
				file: 'list-returns-sorted-paths-and-blob-hashes-for-tracked-and-un.json'
			},
			[{ name: 'tracked and untracked files are listed in path order', input: { tracked: 'README.md', untracked: 'src/entry.ts' }, output: entries }]
		);
	});
}, 20_000);

test('read returns current UTF-8 file contents on each call', async () => {
	await withTempRepo(async ({ root }) => {
		writeFileSync(join(root, 'README.md'), 'first\n');
		const adapter = new WorkingTreeAdapter(root);
		const first = await adapter.read('README.md');
		writeFileSync(join(root, 'README.md'), 'updated\n');
		const second = await adapter.read('README.md');
		expect(first).toBe('first\n');
		expect(second).toBe('updated\n');
		recordExampleCases(
			{
				unitId: 'adapter.working-tree',
				symbol: 'WorkingTreeAdapter.read',
				state: 'read-returns-current-utf-8-file-contents-on-each-call',
				evidence: 'examples-cases',
				file: 'read-returns-current-utf-8-file-contents-on-each-call.json'
			},
			[{ name: 'reading again observes changed disk text', input: { path: 'README.md', contents: ['first\\n', 'updated\\n'] }, output: second }]
		);
	});
}, 20_000);

test('Throws Error when repository scanning cannot start', async () => {
	await withTempDir('working-tree-examples-', async (directory) => {
		const adapter = new WorkingTreeAdapter(join(directory, 'missing-root'));
		await expect(adapter.list()).rejects.toThrow();
		recordExampleCases(
			{
				unitId: 'adapter.working-tree',
				symbol: 'WorkingTreeAdapter.list',
				state: 'throws-error-when-repository-scanning-cannot-start',
				evidence: 'examples-cases',
				file: 'throws-error-when-repository-scanning-cannot-start.json'
			},
			[{ name: 'missing working tree rejects during repository detection', input: { root: join(directory, 'missing-root') }, error: 'Git command could not start' }]
		);
	});
}, 20_000);

test('Throws Error when read cannot find the requested file', async () => {
	await withTempRepo(async ({ root }) => {
		const adapter = new WorkingTreeAdapter(root);
		await expect(adapter.read('missing.txt')).rejects.toThrow();
		recordExampleCases(
			{
				unitId: 'adapter.working-tree',
				symbol: 'WorkingTreeAdapter.read',
				state: 'throws-error-when-read-cannot-find-the-requested-file',
				evidence: 'examples-cases',
				file: 'throws-error-when-read-cannot-find-the-requested-file.json'
			},
			[{ name: 'missing file rejects with a filesystem error', input: { path: 'missing.txt' }, error: 'ENOENT' }]
		);
	});
}, 20_000);

test('Throws TypeError when read path is not a string', async () => {
	await withTempRepo(async ({ root }) => {
		const adapter = new WorkingTreeAdapter(root);
		expect(() => adapter.read(42 as unknown as string)).toThrow(TypeError);
		recordExampleCases(
			{
				unitId: 'adapter.working-tree',
				symbol: 'WorkingTreeAdapter.read',
				state: 'throws-typeerror-when-read-path-is-not-a-string',
				evidence: 'examples-cases',
				file: 'throws-typeerror-when-read-path-is-not-a-string.json'
			},
			[{ name: 'numeric path throws before a promise is returned', input: { path: 42 }, error: 'TypeError' }]
		);
	});
}, 20_000);
