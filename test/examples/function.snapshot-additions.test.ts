import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	declaredOutput,
	snapshotAdditions
} from '../../src/adapters/verification-evidence/snapshot-adapter/snapshotAdditions';
import type { SnapshotBounds } from '../../src/utils/verification-evidence/snapshotAdditions';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Matches declared output files and folders', () => {
	const cases = [
		{
			name: 'file matches declared folder prefix',
			input: { path: 'dist/assets/app.js', outputs: ['dist/'] },
			output: true
		},
		{
			name: 'folder itself matches trailing slash pattern',
			input: { path: 'coverage', outputs: ['coverage/'] },
			output: true
		},
		{
			name: 'empty declarations cover nothing',
			input: { path: 'reports/summary.json', outputs: [] },
			output: false
		}
	];
	for (const item of cases)
		expect(declaredOutput(item.input.path, item.input.outputs)).toBe(item.output);
	recordExampleCases(
		{
			unitId: 'function.snapshot-additions',
			symbol: 'declaredOutput',
			state: 'matches-declared-output-files-and-folders',
			evidence: 'examples-cases',
			file: 'matches-declared-output-files-and-folders.json'
		},
		cases
	);
});

test('Finds untracked files outside outputs and shared links', async () => {
	await withTempDir('snapshot-additions-', async (directory) => {
		await mkdir(join(directory, 'dist'), { recursive: true });
		await mkdir(join(directory, 'scratch'), { recursive: true });
		await mkdir(join(directory, 'vendor'), { recursive: true });
		await writeFile(join(directory, 'README.md'), 'tracked');
		await writeFile(join(directory, 'dist', 'bundle.js'), 'output');
		await writeFile(join(directory, 'scratch', 'trace.log'), 'addition');
		await writeFile(join(directory, 'vendor', 'shared.txt'), 'link');
		const bounds: SnapshotBounds = {
			tracked: new Set(['README.md']),
			outputs: ['dist/'],
			links: new Set(['vendor'])
		};
		const output = await snapshotAdditions(directory, bounds);
		expect(output).toEqual(['scratch/trace.log']);
		recordExampleCases(
			{
				unitId: 'function.snapshot-additions',
				symbol: 'snapshotAdditions',
				state: 'finds-untracked-files-outside-outputs-and-shared-links',
				evidence: 'examples-cases',
				file: 'finds-untracked-files-outside-outputs-and-shared-links.json'
			},
			[
				{
					name: 'ignores tracked files, declared output trees and shared links',
					input: { tracked: ['README.md'], outputs: ['dist/'], links: ['vendor'] },
					output
				}
			]
		);
	});
});

test('Throws NodeJS.ErrnoException when the root is missing', async () => {
	await withTempDir('snapshot-additions-missing-', async (directory) => {
		let error: { code?: string } | undefined;
		try {
			await snapshotAdditions(join(directory, 'missing'), {
				tracked: new Set(),
				outputs: [],
				links: new Set()
			});
		} catch (caught) {
			error = caught as { code?: string };
		}
		expect(error?.code).toBe('ENOENT');
		recordExampleCases(
			{
				unitId: 'function.snapshot-additions',
				symbol: 'snapshotAdditions',
				state: 'throws-nodejs-errnoexception-when-the-root-is-missing',
				evidence: 'examples-cases',
				file: 'throws-nodejs-errnoexception-when-the-root-is-missing.json'
			},
			[
				{
					name: 'rejects when the snapshot root does not exist',
					input: { root: 'missing' },
					error: { code: error?.code }
				}
			]
		);
	});
});
