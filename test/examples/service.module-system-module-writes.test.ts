import type { Cases } from './service.module-system-module-writes.test.types';
import { mkdir, readdir, readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { writeModuleFiles, moduleOutputPath } from '../../src/services/module-system/moduleWrites';

const UNIT = 'service.module-system-module-writes';
const SOURCE = 'src/services/reports/evidence-grid.ts';
const TEST = 'tests/services/reports/evidence-grid.test.ts';
const FILES = [
	{ path: SOURCE, contents: 'export {};\n' },
	{ path: TEST, contents: 'export {};\n' }
];
const UNSAFE_PATHS = ['../secrets.ts', 'src/a/../b.ts', 'src/{{name}}.ts'];

function record(symbol: string, state: string, cases: Cases): void {
	recordExampleCases(
		{ unitId: UNIT, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

test('Writes planned files and reports their paths', async () => {
	const state = 'writes-planned-files-and-reports-their-paths';
	await withTempDir('module-writes-created-', async (root) => {
		const written = await writeModuleFiles(root, FILES);
		expect(written).toEqual([SOURCE, TEST]);
		expect(await readFile(join(root, SOURCE), 'utf8')).toBe('export {};\n');
		record('writeModuleFiles', state, [
			{
				name: 'two new files under src and tests',
				input: { paths: [SOURCE, TEST] },
				output: written
			}
		]);
	});
});

test('Skips identical files and refuses unreplaced overwrites', async () => {
	const state = 'skips-identical-files-and-refuses-unreplaced-overwrites';
	const changed = { path: SOURCE, contents: 'export const version = 2;\n' };
	await withTempDir('module-writes-overwrite-', async (root) => {
		await writeModuleFiles(root, [FILES[0]]);
		const identical = await writeModuleFiles(root, [FILES[0]]);
		await expect(writeModuleFiles(root, [changed])).rejects.toThrow(
			`Refusing to overwrite existing ${SOURCE}.`
		);
		const replaced = await writeModuleFiles(root, [changed], [SOURCE]);
		expect(identical).toEqual([]);
		expect(replaced).toEqual([SOURCE]);
		record('writeModuleFiles', state, [
			{
				name: 'identical existing file is skipped',
				input: { path: SOURCE, contents: FILES[0].contents, replace: [] },
				output: identical
			},
			{
				name: 'different existing file without replace is refused',
				input: { path: SOURCE, contents: changed.contents, replace: [] },
				error: { message: `Refusing to overwrite existing ${SOURCE}.` }
			},
			{
				name: 'different existing file listed in replace is overwritten',
				input: { path: SOURCE, contents: changed.contents, replace: [SOURCE] },
				output: replaced
			}
		]);
	});
});

test('Refuses to write through a symlinked directory', async () => {
	const state = 'refuses-to-write-through-a-symlinked-directory';
	await withTempDir('module-writes-symlink-', async (root) => {
		await mkdir(join(root, 'outside'));
		await symlink(join(root, 'outside'), join(root, 'src'));
		const plan = [{ path: SOURCE, contents: 'export {};\n' }];
		await expect(writeModuleFiles(root, plan)).rejects.toThrow(
			`Module output crosses symlink: ${SOURCE}`
		);
		expect(await readdir(join(root, 'outside'))).toEqual([]);
		record('writeModuleFiles', state, [
			{
				name: 'planned file under a symlinked src directory',
				input: { path: SOURCE, symlinkTarget: 'outside' },
				error: { message: `Module output crosses symlink: ${SOURCE}` }
			}
		]);
	});
});

test('Rejects unsafe module output paths', () => {
	const state = 'rejects-unsafe-module-output-paths';
	expect(moduleOutputPath('harness.modules.json')).toBe('harness.modules.json');
	const cases: Cases = [
		{
			name: 'root manifest path is returned unchanged',
			input: { path: 'harness.modules.json' },
			output: 'harness.modules.json'
		}
	];
	for (const path of UNSAFE_PATHS) {
		const message = `Unsafe module output path: ${path}`;
		expect(() => moduleOutputPath(path)).toThrow(message);
		cases.push({ name: `rejects ${path}`, input: { path }, error: { message } });
	}
	record('moduleOutputPath', state, cases);
});
