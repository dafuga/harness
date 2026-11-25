import { rmSync, writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { VitestReportAdapter } from '../../src/services/reports-media/report-command-service/VitestReportAdapter';
import type { ReportRepository } from '../../src/repositories/reports-media/report-repository/ReportRepository';
import { createFixture } from './reports.adapter.vitest-report.cases';

test('ingest records a summary when no assertions are supplied', async () => {
	const fixture = createFixture({ numPassedTests: 4, numFailedTests: 1, numPendingTests: 2 });
	try {
		const id = '';
		const input = { id, file: fixture.file };
		const output = await new VitestReportAdapter().ingest(fixture.store, id, fixture.file);
		expect(output).toEqual({ checks: 0 });
		expect(fixture.calls).toEqual([
			{
				id,
				entry: {
					kind: 'check',
					data: {
						id: 'vitest-summary',
						title: 'Vitest results',
						status: 'not-proven',
						counts: { passed: 4, failed: 1, skipped: 2 },
						group: 'Vitest - no individual test results supplied'
					}
				}
			}
		]);
		recordExampleCases(
			{
				unitId: 'reports.adapter.vitest-report',
				symbol: 'VitestReportAdapter.ingest',
				state: 'ingest-records-a-summary-when-no-assertions-are-supplied',
				evidence: 'examples-cases',
				file: 'ingest-records-a-summary-when-no-assertions-are-supplied.json'
			},
			[
				{
					name: 'aggregate counts become a summary check',
					input,
					output: { checks: output.checks, record: fixture.calls[0].entry }
				}
			]
		);
	} finally {
		rmSync(fixture.directory, { recursive: true, force: true });
	}
}, 20_000);

test('Throws Error when the report file cannot be read', async () => {
	const fixture = createFixture({});
	rmSync(fixture.file);
	try {
		const input = { id: 'report-20261110-0193', file: fixture.file };
		const promise = new VitestReportAdapter().ingest(fixture.store, input.id, input.file);
		await expect(promise).rejects.toMatchObject({ code: 'ENOENT' });
		recordExampleCases(
			{
				unitId: 'reports.adapter.vitest-report',
				symbol: 'VitestReportAdapter.ingest',
				state: 'throws-error-when-the-report-file-cannot-be-read',
				evidence: 'examples-cases',
				file: 'throws-error-when-the-report-file-cannot-be-read.json'
			},
			[
				{
					name: 'missing report path propagates read error',
					input,
					error: { name: 'Error', code: 'ENOENT' }
				}
			]
		);
	} finally {
		rmSync(fixture.directory, { recursive: true, force: true });
	}
}, 20_000);

test('Throws SyntaxError when report content is invalid JSON', async () => {
	const fixture = createFixture({});
	writeFileSync(fixture.file, '{invalid');
	try {
		const input = { id: 'report-20261114-0007', file: fixture.file };
		const promise = new VitestReportAdapter().ingest(fixture.store, input.id, input.file);
		await expect(promise).rejects.toBeInstanceOf(SyntaxError);
		recordExampleCases(
			{
				unitId: 'reports.adapter.vitest-report',
				symbol: 'VitestReportAdapter.ingest',
				state: 'throws-syntaxerror-when-report-content-is-invalid-json',
				evidence: 'examples-cases',
				file: 'throws-syntaxerror-when-report-content-is-invalid-json.json'
			},
			[
				{
					name: 'malformed JSON is rejected',
					input: { ...input, content: '{invalid' },
					error: { name: 'SyntaxError' }
				}
			]
		);
	} finally {
		rmSync(fixture.directory, { recursive: true, force: true });
	}
}, 20_000);

test('Throws TypeError when parsed report root is null', async () => {
	const fixture = createFixture({});
	writeFileSync(fixture.file, 'null');
	try {
		const input = { id: 'report-20261115-0042', file: fixture.file, content: null };
		const promise = new VitestReportAdapter().ingest(fixture.store, input.id, input.file);
		await expect(promise).rejects.toBeInstanceOf(TypeError);
		recordExampleCases(
			{
				unitId: 'reports.adapter.vitest-report',
				symbol: 'VitestReportAdapter.ingest',
				state: 'throws-typeerror-when-parsed-report-root-is-null',
				evidence: 'examples-cases',
				file: 'throws-typeerror-when-parsed-report-root-is-null.json'
			},
			[{ name: 'null root is not guarded', input, error: { name: 'TypeError' } }]
		);
	} finally {
		rmSync(fixture.directory, { recursive: true, force: true });
	}
}, 20_000);

test('Throws record rejection unchanged when repository rejects', async () => {
	const fixture = createFixture({
		testResults: [{ assertionResults: [{ title: 'passes', status: 'passed' }] }]
	});
	const failure = new Error('record failed');
	const store = {
		record: async () => {
			throw failure;
		}
	} as unknown as ReportRepository;
	try {
		const input = { id: 'report-20261110-0193', file: fixture.file };
		const promise = new VitestReportAdapter().ingest(store, input.id, input.file);
		await expect(promise).rejects.toBe(failure);
		recordExampleCases(
			{
				unitId: 'reports.adapter.vitest-report',
				symbol: 'VitestReportAdapter.ingest',
				state: 'throws-record-rejection-unchanged-when-repository-rejects',
				evidence: 'examples-cases',
				file: 'throws-record-rejection-unchanged-when-repository-rejects.json'
			},
			[
				{
					name: 'repository error propagates unchanged',
					input,
					error: { name: 'Error', message: failure.message }
				}
			]
		);
	} finally {
		rmSync(fixture.directory, { recursive: true, force: true });
	}
}, 20_000);
