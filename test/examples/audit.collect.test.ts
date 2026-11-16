import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { collectAuditedFiles } from '../../src/audit/development-tooling/collect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Collects recursive files and records ignored paths', async () => {
	await withTempDir('audit-collect-examples-', async (root) => {
		await mkdir(join(root, 'src', 'audit'), { recursive: true });
		await mkdir(join(root, 'node_modules'));
		await writeFile(join(root, 'package.JSON'), '{}');
		await writeFile(join(root, 'src', 'audit', 'collect.TS'), 'export {};');
		await writeFile(join(root, 'node_modules', 'ignored.ts'), 'ignored');
		await symlink(join(root, 'src', 'audit', 'collect.TS'), join(root, 'src', 'current-link'));

		const collected = await collectAuditedFiles(root);
		const files = [...collected.files].sort((left, right) => left.path.localeCompare(right.path));
		const dirs = [...collected.dirs].sort();
		const ignoredPaths = [...collected.ignoredPaths].sort();

		expect(files).toEqual([
			{ path: join(root, 'package.JSON'), extension: '.json' },
			{ path: join(root, 'src', 'audit', 'collect.TS'), extension: '.ts' }
		]);
		expect(dirs).toEqual(['src/', 'src/audit/']);
		expect(ignoredPaths).toEqual(['node_modules/', 'src/current-link']);
		recordExampleCases(
			{
				unitId: 'audit.collect',
				symbol: 'collectAuditedFiles',
				state: 'collects-recursive-files-and-records-ignored-paths',
				evidence: 'examples-cases',
				file: 'collects-recursive-files-and-records-ignored-paths.json'
			},
			[
				{
					name: 'Recursive collection lowercases extensions and skips node_modules and symlinks',
					input: {
						root,
						files: ['package.JSON', 'src/audit/collect.TS', 'node_modules/ignored.ts'],
						symlink: 'src/current-link'
					},
					output: { files, dirs, ignoredPaths }
				}
			]
		);
	});
});

test('Propagates filesystem errors for missing roots', async () => {
	await withTempDir('audit-collect-errors-', async (directory) => {
		const root = join(directory, 'missing-project');
		let observedError: unknown;
		try {
			await collectAuditedFiles(root);
		} catch (error) {
			observedError = error;
		}

		expect(observedError).toBeInstanceOf(Error);
		const failure = observedError as Error & { code: string };
		expect(failure.code).toBe('ENOENT');
		recordExampleCases(
			{
				unitId: 'audit.collect',
				symbol: 'collectAuditedFiles',
				state: 'propagates-filesystem-errors-for-missing-roots',
				evidence: 'examples-cases',
				file: 'propagates-filesystem-errors-for-missing-roots.json'
			},
			[
				{
					name: 'A missing root preserves the filesystem ENOENT error',
					input: { root },
					error: {
						name: failure.name,
						code: failure.code,
						message: failure.message
					}
				}
			]
		);
	});
});
