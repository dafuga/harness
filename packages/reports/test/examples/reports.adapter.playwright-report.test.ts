import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { PlaywrightReportAdapter } from '../../src/services/reports-media/report-command-service/PlaywrightReportAdapter';
import type { Written, Store } from './reports.adapter.playwright-report.test.types';

const REPORT_ID = 'report-2026-11-15-001';
const FILE_NAME = 'playwright-report.json';

const report = {
	suites: [
		{
			specs: [
				{
					title: 'opens the home page',
					tests: [
						{
							status: 'expected',
							results: [
								{
									status: 'passed',
									duration: 12,
									attachments: [
										{ name: 'screenshot', path: 'shots/home.png' },
										{ name: 'trace', path: 'trace.zip' }
									]
								}
							]
						}
					]
				}
			],
			suites: [
				{
					specs: [
						{
							title: 'submits the form',
							tests: [{ status: 'unexpected', results: [{ status: 'failed', duration: 30 }] }]
						},
						{ title: 'has no tests', tests: [] }
					]
				}
			]
		}
	]
};

function fakeStore(written: Written[], failure?: Error): Store {
	const record = (id: string, entry: Written['entry']): Promise<void> => {
		if (failure) return Promise.reject(failure);
		written.push({ id, entry });
		return Promise.resolve();
	};
	return { record } as unknown as Store;
}

function writeReport(directory: string, content: unknown): string {
	const file = join(directory, FILE_NAME);
	writeFileSync(file, JSON.stringify(content));
	return file;
}

function summarise(written: Written[], directory: string) {
	return written.map(({ id, entry }) => {
		const data = { ...entry.data };
		if (typeof data.path === 'string') data.path = relative(directory, data.path);
		return { id, kind: entry.kind, data };
	});
}

test('Ingests qualifying specs and image evidence', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'playwright-report-examples-'));
	try {
		const file = writeReport(directory, report);
		const written: Written[] = [];
		const output = await new PlaywrightReportAdapter().ingest(fakeStore(written), REPORT_ID, file);
		expect(output).toEqual({ checks: 2 });
		expect(written.map((item) => item.entry.kind)).toEqual(['check', 'evidence', 'check']);
		recordExampleCases(
			{
				unitId: 'reports.adapter.playwright-report',
				symbol: 'PlaywrightReportAdapter.ingest',
				state: 'ingests-qualifying-specs-and-image-evidence',
				evidence: 'examples-cases',
				file: 'ingests-qualifying-specs-and-image-evidence.json'
			},
			[
				{
					name: 'two qualifying specs and one png attachment are recorded',
					input: { id: REPORT_ID, file: FILE_NAME },
					output: { checks: output.checks, records: summarise(written, directory) }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Reports zero checks for a report without suites', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'playwright-report-examples-'));
	try {
		const file = writeReport(directory, {});
		const written: Written[] = [];
		const output = await new PlaywrightReportAdapter().ingest(fakeStore(written), REPORT_ID, file);
		expect(output).toEqual({ checks: 0 });
		expect(written).toHaveLength(0);
		recordExampleCases(
			{
				unitId: 'reports.adapter.playwright-report',
				symbol: 'PlaywrightReportAdapter.ingest',
				state: 'reports-zero-checks-for-a-report-without-suites',
				evidence: 'examples-cases',
				file: 'reports-zero-checks-for-a-report-without-suites.json'
			},
			[
				{
					name: 'empty object report records no checks',
					input: { id: REPORT_ID, file: FILE_NAME, content: {} },
					output
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Rejects a report file that is not JSON', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'playwright-report-examples-'));
	try {
		const file = join(directory, FILE_NAME);
		writeFileSync(file, '{ "suites": [');
		const error = await new PlaywrightReportAdapter()
			.ingest(fakeStore([]), REPORT_ID, file)
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(SyntaxError);
		recordExampleCases(
			{
				unitId: 'reports.adapter.playwright-report',
				symbol: 'PlaywrightReportAdapter.ingest',
				state: 'rejects-a-report-file-that-is-not-json',
				evidence: 'examples-cases',
				file: 'rejects-a-report-file-that-is-not-json.json'
			},
			[
				{
					name: 'truncated JSON rejects with SyntaxError',
					input: { id: REPORT_ID, file: FILE_NAME, content: '{ "suites": [' },
					error: { name: 'SyntaxError' }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Propagates a store record rejection unchanged', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'playwright-report-examples-'));
	try {
		const file = writeReport(directory, report);
		const failure = new Error('store unavailable');
		const error = await new PlaywrightReportAdapter()
			.ingest(fakeStore([], failure), REPORT_ID, file)
			.catch((caught: unknown) => caught);
		expect(error).toBe(failure);
		recordExampleCases(
			{
				unitId: 'reports.adapter.playwright-report',
				symbol: 'PlaywrightReportAdapter.ingest',
				state: 'propagates-a-store-record-rejection-unchanged',
				evidence: 'examples-cases',
				file: 'propagates-a-store-record-rejection-unchanged.json'
			},
			[
				{
					name: 'first store write failure rejects ingest with the same error',
					input: { id: REPORT_ID, file: FILE_NAME },
					error: { message: failure.message }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
