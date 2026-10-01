import { afterEach, beforeEach, expect, test } from 'vitest';
import { rm } from 'node:fs/promises';
import { resolveCleanCodeSettings } from '../src/audit/cleanCodeConfig';
import { matchesExclusion } from '../src/audit/cleanCodeDiscovery';
import { reviewCleanCode } from '../src/workflows/reviewCleanCode';
import { fixtureEvaluation, reviewFixtureRoot, reviewSettings } from './support/cleanCodeFixture';

let root: string;
beforeEach(async () => {
	root = await reviewFixtureRoot();
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('reviews are disabled by default and flags preserve an explicitly configured gate', () => {
	expect(resolveCleanCodeSettings(undefined).mode).toBe('off');
	expect(resolveCleanCodeSettings(undefined, { enabled: true }).mode).toBe('advisory');
	expect(resolveCleanCodeSettings({ mode: 'gate' }, { enabled: true }).mode).toBe('gate');
	expect(resolveCleanCodeSettings(undefined, { gate: true }).mode).toBe('gate');
});

test('recursive exclusions match root files as well as nested paths', () => {
	expect(matchesExclusion('index.ts', '**/*.ts')).toBe(true);
	expect(matchesExclusion('src/utils/greet.ts', '**/*.ts')).toBe(true);
	expect(matchesExclusion('src/utils/greet.ts', 'src/*.ts')).toBe(false);
});

test.each([
	{ mode: 'other' },
	{ minConfidence: Number.NaN },
	{ minConfidence: 0 },
	{ model: 'another-provider' },
	{ apiKeyEnv: 'lowercase' },
	{ exclude: [3] }
])('rejects invalid settings: %j', (settings) => {
	expect(() => resolveCleanCodeSettings(settings)).toThrow('cleanCode');
});

test('insufficient context remains a visible non-clean review item', async () => {
	const report = await reviewCleanCode({
		root,
		settings: reviewSettings,
		evaluate: async (request) => fixtureEvaluation(request, 'insufficient_context')
	});
	expect(report.status).toBe('needs-review');
	expect(report.files[0].assessments.every((item) => item.status === 'needs-review')).toBe(true);
});

test('confident violations use source-grounded spans and account for both API calls', async () => {
	const report = await reviewCleanCode({
		root,
		settings: reviewSettings,
		evaluate: async (request) => fixtureEvaluation(request, 'violates')
	});
	expect(report.status).toBe('violations');
	expect(report.files[0].assessments[0].location).toMatchObject({
		startLine: 1,
		excerpt: expect.stringContaining('function greet')
	});
	expect(report.usage).toEqual({ input_tokens: 200, output_tokens: 40 });
});

test('failed requested reviews are incomplete', async () => {
	const report = await reviewCleanCode({
		root,
		settings: reviewSettings,
		evaluate: async () => {
			throw new Error('Provider unavailable');
		}
	});
	expect(report.status).toBe('incomplete');
	expect(report.files[0].assessments).toEqual([]);
});

test('dry runs inventory files without evaluating or requiring credentials', async () => {
	let calls = 0;
	const report = await reviewCleanCode({
		root,
		settings: reviewSettings,
		options: { dryRun: true },
		evaluate: async (request) => {
			calls++;
			return fixtureEvaluation(request);
		}
	});
	expect(calls).toBe(0);
	expect(report.status).toBe('dry-run');
	expect(report.coverage.selectedFiles).toEqual(['src/utils/greet.ts']);
});
