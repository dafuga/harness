import { afterEach, beforeEach, expect, test } from 'vitest';
import { rm, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { snapshotCleanCodeFile } from '../src/audit/cleanCodeSnapshot';
import { reviewCleanCode } from '../src/workflows/reviewCleanCode';
import {
	fixtureEvaluation,
	reviewFixtureRoot,
	reviewSettings,
	writeReviewFixture
} from './support/cleanCodeFixture';

let root: string;
beforeEach(async () => {
	root = await reviewFixtureRoot();
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('discovery excludes gitignored, generated, vendor, explicit, and symlink paths', async () => {
	spawnSync('git', ['init', '-q', root]);
	await writeReviewFixture(root, '.gitignore', 'ignored.ts\n');
	for (const path of [
		'src/utils/ignored.ts',
		'src/utils/manual.ts',
		'src/utils/code.generated.ts',
		'dist/output.ts',
		'vendor/other.ts',
		'src/utils/other.rs'
	]) {
		await writeReviewFixture(root, path, 'synthetic code');
	}
	await symlink(join(root, 'src/utils/greet.ts'), join(root, 'src/utils/link.ts'));
	const report = await reviewCleanCode({
		root,
		settings: { ...reviewSettings, exclude: ['**/manual.ts'] },
		options: { dryRun: true }
	});
	expect(report.coverage.selectedFiles).toEqual(['src/utils/greet.ts']);
	expect(report.coverage.excludedPaths.map((item) => item.path)).toEqual(
		expect.arrayContaining([
			'src/utils/ignored.ts',
			'src/utils/manual.ts',
			'src/utils/code.generated.ts',
			'src/utils/link.ts',
			'vendor/other.ts',
			'dist/'
		])
	);
	expect(report.coverage.unsupportedFiles).toContain('src/utils/other.rs');
});

test('context contains direct imports, matching tests, and local conventions', async () => {
	await writeReviewFixture(
		root,
		'src/utils/greet.ts',
		"import { prefix } from './prefix.js';\nexport const greet = () => prefix;\n"
	);
	await writeReviewFixture(root, 'src/utils/prefix.ts', "export const prefix = 'Hello';\n");
	await writeReviewFixture(root, 'test/utils/greet.test.ts', 'test code');
	await writeReviewFixture(root, 'AGENTS.md', 'Prefer meaningful names.');
	const files = ['src/utils/greet.ts', 'src/utils/prefix.ts', 'test/utils/greet.test.ts'];
	const snapshot = await snapshotCleanCodeFile({ root, path: files[0], files, findings: [] });
	expect(snapshot.contextPaths).toEqual(expect.arrayContaining([files[1], files[2], 'AGENTS.md']));
	expect(snapshot.state).toContain('Prefer meaningful names');
});

test('imports cannot supply code outside the project', async () => {
	await writeReviewFixture(
		root,
		'src/utils/greet.ts',
		"import secret from '../../../outside.ts';\n"
	);
	const snapshot = await snapshotCleanCodeFile({
		root,
		path: 'src/utils/greet.ts',
		files: ['../outside.ts'],
		findings: []
	});
	expect(snapshot.contextPaths).toEqual([]);
	expect(snapshot.state).not.toContain('secret external content');
});

test('oversized targets are incomplete without truncation or an API call', async () => {
	await writeReviewFixture(root, 'src/utils/greet.ts', '// ' + 'x'.repeat(25000));
	let calls = 0;
	const report = await reviewCleanCode({
		root,
		settings: reviewSettings,
		evaluate: async (request) => {
			calls++;
			return fixtureEvaluation(request);
		}
	});
	expect(report.status).toBe('incomplete');
	expect(report.files[0].error).toContain('no code was truncated');
	expect(calls).toBe(0);
});

test('source changed during evaluation is discarded', async () => {
	const report = await reviewCleanCode({
		root,
		settings: reviewSettings,
		evaluate: async (request) => {
			await writeReviewFixture(root, 'src/utils/greet.ts', 'export const changed = true;\n');
			return fixtureEvaluation(request);
		}
	});
	expect(report.status).toBe('incomplete');
	expect(report.files[0].assessments).toEqual([]);
	expect(report.files[0].error).toContain('changed');
});
