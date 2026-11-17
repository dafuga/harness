import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { frozenBuild } from '../../src/utils/development-tooling/frozenBuild';

test('Copies a finished build into its run directory', async () => {
	const root = mkdtempSync(join(tmpdir(), 'freeze-build-'));
	try {
		const source = join(root, 'project', 'build');
		const target = join(root, '.cache', 'reports-e2e', 'example-run', 'build');
		mkdirSync(source, { recursive: true });
		writeFileSync(join(source, 'index.html'), '<main>Example report</main>');
		const output = await frozenBuild(source, target);
		expect(output.build).toBe(target);
		expect(output.files).toBe(1);
		expect(output.buildId).toMatch(/^[a-f0-9]{64}$/);
		recordExampleCases(
			{
				unitId: 'reports.script.freeze-build',
				symbol: 'frozenBuild',
				state: 'copies-a-finished-build-into-its-run-directory',
				evidence: 'examples-cases',
				file: 'copies-a-finished-build-into-its-run-directory.json'
			},
			[
				{
					name: 'copies one finished build file',
					input: { source, target, files: ['index.html'] },
					output
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test('Throws Error when the source directory contains no build', async () => {
	const root = mkdtempSync(join(tmpdir(), 'freeze-build-empty-'));
	try {
		const source = join(root, 'empty-build');
		const target = join(root, 'run-build');
		mkdirSync(source);
		const error = new Error(`${source} holds no build: build the reports package first.`);
		await expect(frozenBuild(source, target)).rejects.toThrow(error.message);
		recordExampleCases(
			{
				unitId: 'reports.script.freeze-build',
				symbol: 'frozenBuild',
				state: 'throws-error-when-the-source-directory-contains-no-build',
				evidence: 'examples-cases',
				file: 'throws-error-when-the-source-directory-contains-no-build.json'
			},
			[
				{
					name: 'rejects an empty source directory',
					input: { source, target },
					error: error.message
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
