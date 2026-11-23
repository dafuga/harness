import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { RecordInput, Report } from '../../src/models/reports-media/Report.types';
import { reportIngest } from '../../src/repositories/reports-media/report-repository/reportIngest';

const RUN_DIRECTORY =
	'/workspace/project/.harness/project-reports/runs/7f9c2b1e-4a3d-4e8b-9c1a-2d5e6f7a8b90';
const SUMMARY = 'Desktop checkout passes; the mobile layout is still under review.';
const SUMMARY_RECORD: RecordInput = { kind: 'summary', data: { text: SUMMARY } };
const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

function makeReport(): Report {
	return {
		schemaVersion: 1,
		id: '7f9c2b1e-4a3d-4e8b-9c1a-2d5e6f7a8b90',
		project: { id: 'a41f0c9d2b7e3f58', name: 'storefront', path: '/workspace/project' },
		title: 'Checkout flow',
		mode: 'feature',
		environment: 'local',
		historical: false,
		startedAt: '2026-11-15T09:12:44.318Z',
		updatedAt: '2026-11-15T09:12:44.318Z',
		summary: '',
		status: 'running',
		state: 'active',
		checks: [],
		evidence: [],
		findings: [],
		coverage: [],
		acceptance: ['Guest checkout completes', 'Totals match the cart']
	};
}

function checkRecordFor(id: string, status: string): RecordInput {
	return {
		kind: 'check',
		data: { id, title: 'guest checkout completes', status, durationMs: 8421, group: 'Playwright' }
	};
}

function evidenceRecord(path: string): RecordInput {
	return {
		kind: 'evidence',
		data: {
			id: 'pw-1-0',
			title: 'guest checkout completes - desktop',
			category: 'Playwright',
			status: 'passed',
			path,
			checkId: 'pw-1',
			order: 1
		}
	};
}

function summarise(report: Report) {
	return {
		summary: report.summary,
		checks: report.checks.map((check) => `${check.id}:${check.status}`)
	};
}

function errorMessage(caught: unknown) {
	return caught instanceof Error ? caught.message : String(caught);
}

async function withTempDir(run: (directory: string) => Promise<void>) {
	const directory = mkdtempSync(join(tmpdir(), 'reports-ingest-'));
	try {
		await run(directory);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

test('Summary and check records update the report in place', async () => {
	const report = makeReport();
	const returned = await reportIngest(report, SUMMARY_RECORD, RUN_DIRECTORY);
	const afterSummary = summarise(report);
	const check = checkRecordFor('pw-1', 'passed');
	const afterCheck = await reportIngest(report, check, RUN_DIRECTORY).then(summarise);

	expect(returned).toBe(report);
	expect(afterCheck).toEqual({ summary: SUMMARY, checks: ['pw-1:passed'] });
	expect(Date.parse(report.updatedAt)).not.toBeNaN();
	recordExampleCases(
		{
			unitId: 'reports.function.report-ingest',
			symbol: 'reportIngest',
			state: 'summary-and-check-records-update-the-report-in-place',
			evidence: 'examples-cases',
			file: 'summary-and-check-records-update-the-report-in-place.json'
		},
		[
			{
				name: 'summary record sets the report summary',
				input: SUMMARY_RECORD,
				output: afterSummary
			},
			{ name: 'passed check record is appended', input: check, output: afterCheck }
		]
	);
});

test('Check records with the same id replace the earlier entry', async () => {
	const report = makeReport();
	const first = checkRecordFor('pw-2', 'passed');
	const rerun = checkRecordFor('pw-1', 'failed');
	await reportIngest(report, checkRecordFor('pw-1', 'passed'), RUN_DIRECTORY);
	const afterFirst = await reportIngest(report, first, RUN_DIRECTORY).then(summarise);
	const afterRerun = await reportIngest(report, rerun, RUN_DIRECTORY).then(summarise);

	expect(afterRerun.checks).toEqual(['pw-2:passed', 'pw-1:failed']);
	recordExampleCases(
		{
			unitId: 'reports.function.report-ingest',
			symbol: 'reportIngest',
			state: 'check-records-with-the-same-id-replace-the-earlier-entry',
			evidence: 'examples-cases',
			file: 'check-records-with-the-same-id-replace-the-earlier-entry.json'
		},
		[
			{ name: 'new check id is appended after the existing one', input: first, output: afterFirst },
			{ name: 'rerun with the same id moves it to the end', input: rerun, output: afterRerun }
		]
	);
});

test('Evidence record imports a PNG into the run assets folder', async () => {
	await withTempDir(async (directory) => {
		const source = join(directory, 'desktop.png');
		writeFileSync(source, PNG_BYTES);
		const report = makeReport();
		const record = evidenceRecord(source);
		const updated = await reportIngest(report, record, directory);
		const evidence = updated.evidence[0];

		expect(updated.evidence).toHaveLength(1);
		expect(evidence).toMatchObject({
			id: 'pw-1-0',
			category: 'Playwright',
			status: 'passed',
			checkId: 'pw-1',
			order: 1,
			mediaType: 'image',
			mimeType: 'image/png'
		});
		expect(evidence?.file).toMatch(/\.png$/);
		expect(evidence).not.toHaveProperty('path');
		expect(evidence).not.toHaveProperty('storage');
		recordExampleCases(
			{
				unitId: 'reports.function.report-ingest',
				symbol: 'reportIngest',
				state: 'evidence-record-imports-a-png-into-the-run-assets-folder',
				evidence: 'examples-cases',
				file: 'evidence-record-imports-a-png-into-the-run-assets-folder.json'
			},
			[
				{
					name: 'PNG source is imported as an image evidence item',
					input: { kind: 'evidence', data: { id: 'pw-1-0', path: 'desktop.png', checkId: 'pw-1' } },
					output: {
						id: evidence?.id,
						file: evidence?.file,
						category: evidence?.category,
						status: evidence?.status,
						mediaType: evidence?.mediaType,
						mimeType: evidence?.mimeType
					}
				}
			]
		);
	});
});

test('Evidence with an unsupported extension is rejected', async () => {
	await withTempDir(async (directory) => {
		const source = join(directory, 'report.gif');
		writeFileSync(source, PNG_BYTES);
		const report = makeReport();
		const failure = await reportIngest(report, evidenceRecord(source), directory).then(
			() => 'accepted',
			(caught: unknown) => errorMessage(caught)
		);

		expect(failure).toMatch(/Unsupported evidence format/);
		expect(report.evidence).toEqual([]);
		recordExampleCases(
			{
				unitId: 'reports.function.report-ingest',
				symbol: 'reportIngest',
				state: 'evidence-with-an-unsupported-extension-is-rejected',
				evidence: 'examples-cases',
				file: 'evidence-with-an-unsupported-extension-is-rejected.json'
			},
			[
				{
					name: 'GIF source is refused before any file is written',
					input: { file: 'report.gif' },
					error: failure
				}
			]
		);
	});
});
