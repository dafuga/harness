import { afterEach, beforeEach, expect, test } from 'vitest';
import { rm } from 'node:fs/promises';
import { reviewCleanCode } from '../src/workflows/reviewCleanCode';
import { snapshotCleanCodeFile } from '../src/audit/cleanCodeSnapshot';
import { projectFiles } from '../src/templates/project';
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

test('earlier results are discarded if a later file review changes their source', async () => {
	await writeReviewFixture(root, 'src/utils/later.ts', 'export const later = true;');
	const report = await reviewCleanCode({
		root,
		settings: reviewSettings,
		evaluate: async (request) => {
			if (request.state.includes('"path":"src/utils/later.ts"')) {
				await writeReviewFixture(root, 'src/utils/greet.ts', 'export const changed = true;');
			}
			return fixtureEvaluation(request);
		}
	});
	expect(report.status).toBe('incomplete');
	expect(report.files[0].assessments).toEqual([]);
	expect(report.files[1].status).toBe('clean');
	expect(report.usage.input_tokens).toBe(200);
});

test('successful usage remains counted when localization fails', async () => {
	let calls = 0;
	const report = await reviewCleanCode({
		root,
		settings: reviewSettings,
		evaluate: async (request) => {
			if (++calls === 2) throw new Error('Localization failed');
			return fixtureEvaluation(request, 'violates');
		}
	});
	expect(report.status).toBe('incomplete');
	expect(report.usage).toEqual({ input_tokens: 100, output_tokens: 20 });
});

test('cancellation applies before consulting cached judgments', async () => {
	await reviewCleanCode({
		root,
		settings: reviewSettings,
		evaluate: async (request) => fixtureEvaluation(request)
	});
	const controller = new AbortController();
	controller.abort();
	const report = await reviewCleanCode({
		root,
		settings: reviewSettings,
		options: { signal: controller.signal }
	});
	expect(report.status).toBe('incomplete');
	expect(report.files[0].error).toContain('cancelled');
});

test('audit conventions include only recognized configuration fields', async () => {
	await writeReviewFixture(
		root,
		'harness.audit.json',
		JSON.stringify({
			cleanCode: { mode: 'advisory', apiKey: 'synthetic-secret' },
			customSecret: 'synthetic-secret'
		})
	);
	const snapshot = await snapshotCleanCodeFile({
		root,
		path: 'src/utils/greet.ts',
		files: [],
		findings: []
	});
	expect(snapshot.state).toContain('harness.audit.json');
	expect(snapshot.state).not.toContain('synthetic-secret');
});

test('an oversized localization plan retains file-level findings without an oversized request', async () => {
	await writeReviewFixture(root, 'src/utils/greet.ts', '\n'.repeat(10050));
	let calls = 0;
	const report = await reviewCleanCode({
		root,
		settings: reviewSettings,
		evaluate: async (request) => {
			calls++;
			expect(Buffer.byteLength(request.state)).toBeLessThanOrEqual(24000);
			return fixtureEvaluation(request, 'violates');
		}
	});
	expect(report.status).toBe('violations');
	expect(calls).toBe(1);
	expect(report.files[0].assessments[0].location).toBeUndefined();
});

test.each(['app', 'lib'] as const)(
	'generated %s projects disable review and ignore local secrets/cache',
	(kind) => {
		const files = projectFiles({ name: 'review-project', kind });
		const config = JSON.parse(
			files.find((file) => file.path === 'harness.audit.json')?.contents ?? '{}'
		);
		expect(config.cleanCode.mode).toBe('off');
		const ignore = files.find((file) => file.path === '.gitignore')?.contents;
		expect(ignore).toContain('.cache/');
		expect(ignore).toContain('.env');
		expect(files.find((file) => file.path === 'AGENTS.md')?.contents).toContain(
			'harness info clean-code'
		);
	}
);
