import { test } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import {
	writePlannedFiles,
	ensureParents
} from '../../src/adapters/development-tooling/planned-files/writePlannedFiles';
import type { PlannedFile } from '../../src/core/development-tooling/files.types';
import { renderFileList } from '../../src/core/development-tooling/renderFileList';

const stateId = (name: string) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
const planned: PlannedFile[] = [
	{ path: 'src/generated/summary.ts', contents: 'export const summary = true;\n' },
	{ path: 'src/generated/manifest.json', contents: '{}\n' }
];

test('Writes planned files with create skip and force statuses', async () => {
	await withTempDir('function-files-', async (root) => {
		await ensureParents(root, planned);
		const created = await writePlannedFiles(root, planned);
		const skipped = await writePlannedFiles(root, planned);
		const replacement = { ...planned[0], contents: 'export const summary = false;\n' };
		const overwrittenPath = `${root}/${planned[0].path}`;
		await writeFile(overwrittenPath, planned[0].contents);
		const overwritten = await writePlannedFiles(root, [replacement], { force: true });
		expect([
			created.map(({ path, status }) => ({ path, status })),
			skipped.map(({ status }) => status),
			overwritten[0].status
		]).toEqual([
			[
				{ path: planned[0].path, status: 'created' },
				{ path: planned[1].path, status: 'created' }
			],
			['skipped', 'skipped'],
			'overwritten'
		]);
		recordExampleCases(
			{
				unitId: 'function.files',
				symbol: 'writePlannedFiles',
				state: stateId('Writes planned files with create skip and force statuses'),
				evidence: 'examples-cases',
				file: `${stateId('Writes planned files with create skip and force statuses')}.json`
			},
			[
				{
					name: 'new targets are created',
					input: { root: '/workspace/project', files: planned },
					output: created.map(({ path, status }) => ({ path, status }))
				},
				{
					name: 'identical targets are skipped',
					input: { root: '/workspace/project', files: planned },
					output: skipped.map(({ path, status }) => ({ path, status }))
				},
				{
					name: 'force replaces differing text',
					input: { root: '/workspace/project', files: [replacement], options: { force: true } },
					output: overwritten.map(({ path, status }) => ({ path, status }))
				}
			]
		);
	});
});

test('Creates distinct parent directories without writing files', async () => {
	await withTempDir('function-files-parents-', async (root) => {
		await ensureParents(root, planned);
		const results = await writePlannedFiles(root, planned);
		expect(results.map(({ status }) => status)).toEqual(['created', 'created']);
		const name = 'Creates distinct parent directories without writing files';
		recordExampleCases(
			{
				unitId: 'function.files',
				symbol: 'ensureParents',
				state: stateId(name),
				evidence: 'examples-cases',
				file: `${stateId(name)}.json`
			},
			[
				{
					name: 'nested target parent exists and targets remain unwritten',
					input: { root: '/workspace/project', files: planned },
					output: { parentCreated: true, targetStatuses: results.map(({ status }) => status) }
				}
			]
		);
	});
});

test('Renders file statuses in input order', () => {
	const results = [
		{ ...planned[0], status: 'created' as const },
		{ ...planned[1], status: 'skipped' as const },
		{ ...planned[0], status: 'overwritten' as const }
	];
	const output = renderFileList(results);
	expect(output).toBe(
		'  create src/generated/summary.ts\n  skip src/generated/manifest.json\n  overwrite src/generated/summary.ts'
	);
	const name = 'Renders file statuses in input order';
	recordExampleCases(
		{
			unitId: 'function.files',
			symbol: 'renderFileList',
			state: stateId(name),
			evidence: 'examples-cases',
			file: `${stateId(name)}.json`
		},
		[{ name: 'created skipped and overwritten results', input: results, output }]
	);
});

test('Throws ExpectedCliError when differing contents are not forced', async () => {
	await withTempDir('function-files-refusal-', async (root) => {
		await ensureParents(root, [planned[0]]);
		await writeFile(`${root}/${planned[0].path}`, planned[0].contents);
		const replacement = { ...planned[0], contents: 'export const summary = false;\n' };
		await expect(writePlannedFiles(root, [replacement])).rejects.toThrow(
			`Refusing to overwrite ${planned[0].path}. Re-run with --force to replace it.`
		);
		let errorMessage = '';
		try {
			await writePlannedFiles(root, [replacement]);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		}
		expect(errorMessage).toContain('Refusing to overwrite');
		const name = 'Throws ExpectedCliError when differing contents are not forced';
		recordExampleCases(
			{
				unitId: 'function.files',
				symbol: 'writePlannedFiles',
				state: stateId(name),
				evidence: 'examples-cases',
				file: `${stateId(name)}.json`
			},
			[
				{
					name: 'refuses differing existing text',
					input: { root: '/workspace/project', files: [replacement] },
					error: { message: errorMessage }
				}
			]
		);
	});
});

test('Rethrows filesystem read failures unchanged', async () => {
	await withTempDir('function-files-read-failure-', async (root) => {
		await ensureParents(root, [planned[0]]);
		await writeFile(`${root}/${planned[0].path}`, planned[0].contents);
		const name = 'Rethrows filesystem read failures unchanged';
		let failure: { code?: string; message: string } | undefined;
		try {
			await writePlannedFiles(root, [{ ...planned[0], path: 'src/generated' }]);
		} catch (error) {
			failure = {
				code: error instanceof Error && 'code' in error ? String(error.code) : undefined,
				message: error instanceof Error ? error.message : String(error)
			};
		}
		expect(failure?.code).toBe('EISDIR');
		recordExampleCases(
			{
				unitId: 'function.files',
				symbol: 'writePlannedFiles',
				state: stateId(name),
				evidence: 'examples-cases',
				file: `${stateId(name)}.json`
			},
			[
				{
					name: 'directory target read failure is preserved',
					input: {
						root: '/workspace/project',
						files: [{ path: 'src/generated', contents: 'text' }]
					},
					error: failure
				}
			]
		);
	});
});
