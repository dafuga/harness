import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { format, resolveConfig } from 'prettier';
import { expect } from 'vitest';
import { freePort } from './workers';
import type {
	BrowserBaselineCase,
	BrowserBaselineReport,
	BrowserBaselineSuite
} from './browserBaselineResults.types';

/** Preserve the normal browser matrix, with a private server and a complete child outcome report. */
export async function prepareBrowserBaselineReport(project: string): Promise<void> {
	const path = join(project, 'playwright.config.ts');
	const original = await readFile(path, 'utf8');
	const marker = "testDir: 'tests/e2e',";
	const reporter = "reporter: [['list'], ['./test/support/harnessCaseReporter.js']],";
	const workers = Number(process.env.PLAYWRIGHT_WORKERS ?? 5);
	if (!Number.isInteger(workers) || workers < 1)
		throw new Error('Generated fixture browser workers must be a positive integer.');
	expect(original).toContain(marker);
	expect(original).toContain(reporter);
	const next = original
		.replaceAll('3322', String(await freePort()))
		.replace('reuseExistingServer: true', 'reuseExistingServer: false')
		.replace(marker, marker + `\nworkers: ${workers},`)
		.replace(
			reporter,
			"reporter: [['list'], ['./test/support/harnessCaseReporter.js'], ['json', { outputFile: '.cache/harness/browser-results.json' }]],"
		);
	await writeFile(path, await format(next, { ...(await resolveConfig(path)), filepath: path }));
}

/** An admitted baseline refusal cannot hide a timeout, console error, failed API or skipped case. */
export async function expectMissingScreenshotResults(
	project: string,
	output: string,
	expectedCases: number
): Promise<void> {
	const report = JSON.parse(
		await readFile(join(project, '.cache/harness/browser-results.json'), 'utf8')
	) as BrowserBaselineReport;
	const cases = report.suites.flatMap(casesOf);
	expect(cases.length).toBe(expectedCases);
	expect(report.errors).toEqual([]);
	expect(report.stats.skipped).toBe(0);
	expect(report.stats.flaky).toBe(0);
	expect(report.stats.expected + report.stats.unexpected).toBe(cases.length);
	expect(report.stats.unexpected).toBeGreaterThan(0);
	for (const entry of cases) assertBaselineOutcome(entry);
	const workers = stripVTControlCharacters(output).match(/Running \d+ tests using \d+ workers?/);
	expect(
		workers,
		'The normal matrix must announce its effective browser worker count'
	).not.toBeNull();
	console.info(
		`Generated browser baseline gate: ${workers![0]}; every failure is a missing baseline.`
	);
}

function casesOf(suite: BrowserBaselineSuite): BrowserBaselineCase[] {
	return [
		...(suite.specs ?? []).flatMap((spec) => spec.tests),
		...(suite.suites ?? []).flatMap(casesOf)
	];
}

function assertBaselineOutcome(entry: BrowserBaselineCase): void {
	expect(entry.expectedStatus).toBe('passed');
	expect(entry.results.length).toBeGreaterThan(0);
	for (const result of entry.results) {
		if (result.status === 'passed') expect(result.errors ?? []).toEqual([]);
		else {
			expect(result.status).toBe('failed');
			expect(result.errors?.length ?? 0).toBeGreaterThan(0);
			for (const error of result.errors ?? [])
				expect(error.message).toContain("A snapshot doesn't exist");
		}
	}
	expect(entry.status).toBe(entry.results.at(-1)?.status === 'passed' ? 'expected' : 'unexpected');
}
