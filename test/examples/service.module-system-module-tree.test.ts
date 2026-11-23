import type { Cases } from './service.module-system-module-tree.test.types';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { moduleTree } from '../../src/services/module-system/moduleTree';

const unitId = 'service.module-system-module-tree';

function record(symbol: string, state: string, cases: Cases) {
	return recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

async function writeModule(root: string, name: string, content: string) {
	const directory = join(root, 'specification/modules', name);
	await mkdir(directory, { recursive: true });
	await writeFile(join(directory, 'module.json'), content);
}

const byPath = (a: { path: string }, b: { path: string }) => a.path.localeCompare(b.path);

test('Lists only module directories that contain a module.json', async () => {
	await withTempDir('module-tree-list-', async (root) => {
		await writeModule(root, 'alpha', '{"name":"alpha"}');
		await writeModule(root, 'gamma', '{"name":"gamma"}');
		await mkdir(join(root, 'specification/modules/beta'), { recursive: true });
		await writeFile(join(root, 'specification/modules/notes.txt'), 'not a module');
		const entries = (await moduleTree(root).list()).sort(byPath);

		expect(entries).toEqual([
			{ path: 'specification/modules/alpha/module.json' },
			{ path: 'specification/modules/gamma/module.json' }
		]);
		record('list', 'lists-only-module-directories-that-contain-a-module-json', [
			{
				name: 'alpha and gamma have module.json; beta is empty; notes.txt is a file',
				input: { modules: ['alpha', 'beta', 'gamma'], files: ['notes.txt'] },
				output: entries
			}
		]);
	});
});

test('Returns an empty list when the modules directory is missing', async () => {
	await withTempDir('module-tree-missing-', async (root) => {
		const entries = await moduleTree(root).list();

		expect(entries).toEqual([]);
		record('list', 'returns-an-empty-list-when-the-modules-directory-is-missing', [
			{
				name: 'root has no specification/modules directory',
				input: { root: 'empty temporary directory' },
				output: entries
			}
		]);
	});
});

test('Reads module metadata relative to the root', async () => {
	await withTempDir('module-tree-read-', async (root) => {
		const content = '{"name":"alpha","version":1}';
		await writeModule(root, 'alpha', content);
		const text = await moduleTree(root).read('specification/modules/alpha/module.json');

		expect(text).toBe(content);
		record('read', 'reads-module-metadata-relative-to-the-root', [
			{
				name: 'reads the alpha module.json as UTF-8 text',
				input: { path: 'specification/modules/alpha/module.json' },
				output: text
			}
		]);
	});
});

test('Propagates non-missing errors from module files', async () => {
	await withTempDir('module-tree-eisdir-', async (root) => {
		await mkdir(join(root, 'specification/modules/broken/module.json'), { recursive: true });
		let error: unknown;
		try {
			await moduleTree(root).list();
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as { code?: string }).code).toBe('EISDIR');
		record('list', 'propagates-non-missing-errors-from-module-files', [
			{
				name: 'module.json that is a directory rejects with EISDIR, not an empty entry',
				input: { module: 'broken', moduleFile: 'directory' },
				error: { name: (error as Error).name, code: (error as { code?: string }).code }
			}
		]);
	});
});
