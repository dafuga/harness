import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reviewCleanCode } from '../src/workflows/reviewCleanCode';
import {
	fixtureEvaluation,
	reviewFixtureRoot,
	reviewSettings,
	writeReviewFixture
} from './support/cleanCodeFixture';

let root: string;
let calls: number;
const evaluate = async (request: Parameters<typeof fixtureEvaluation>[0]) => {
	calls++;
	return fixtureEvaluation(request);
};
beforeEach(async () => {
	root = await reviewFixtureRoot();
	calls = 0;
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('identical inputs reuse validated judgments; refresh requests a real review', async () => {
	await reviewCleanCode({ root, settings: reviewSettings, evaluate });
	const cached = await reviewCleanCode({ root, settings: reviewSettings, evaluate });
	expect(calls).toBe(1);
	expect(cached.files[0].cached).toBe(true);
	expect(cached.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
	await reviewCleanCode({ root, settings: reviewSettings, evaluate, options: { refresh: true } });
	expect(calls).toBe(2);
});

test('source, conventions, and rubric settings invalidate the cache', async () => {
	await reviewCleanCode({ root, settings: reviewSettings, evaluate });
	await writeReviewFixture(root, 'src/utils/greet.ts', 'export const greeting = "Hello";\n');
	await reviewCleanCode({ root, settings: reviewSettings, evaluate });
	await writeReviewFixture(root, 'AGENTS.md', 'Use project conventions.');
	await reviewCleanCode({ root, settings: reviewSettings, evaluate });
	await reviewCleanCode({ root, settings: { ...reviewSettings, minConfidence: 0.9 }, evaluate });
	expect(calls).toBe(4);
});

test('corrupt cached responses are ignored', async () => {
	await reviewCleanCode({ root, settings: reviewSettings, evaluate });
	const directory = join(root, '.cache/harness/clean-code');
	const [name] = await readdir(directory);
	await writeFile(join(directory, name), JSON.stringify({ evaluation: { answers: 'invalid' } }));
	const report = await reviewCleanCode({ root, settings: reviewSettings, evaluate });
	expect(calls).toBe(2);
	expect(report.files[0].cached).toBe(false);
});

test('moving model aliases never reuse cached judgments', async () => {
	const settings = { ...reviewSettings, model: 'jev-latest' };
	await reviewCleanCode({ root, settings, evaluate });
	await reviewCleanCode({ root, settings, evaluate });
	expect(calls).toBe(2);
});

test('a cache symlink cannot write outside the project', async () => {
	const external = await mkdtemp(join(tmpdir(), 'harness-jev-external-'));
	try {
		await symlink(external, join(root, '.cache'));
		const report = await reviewCleanCode({ root, settings: reviewSettings, evaluate });
		expect(report.status).toBe('clean');
		expect(await readdir(external)).toEqual([]);
	} finally {
		await rm(external, { recursive: true, force: true });
	}
});
