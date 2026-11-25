import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { VitestReportAdapter } from '../../src/services/reports-media/report-command-service/VitestReportAdapter';
import type { ReportRepository } from '../../src/repositories/reports-media/report-repository/ReportRepository';
import type { VitestData } from '../../src/services/reports-media/report-command-service/VitestReportAdapter.types';

export function createFixture(data: VitestData) {
	const directory = mkdtempSync(join(tmpdir(), 'vitest-report-examples-'));
	const file = join(directory, 'vitest.json');
	writeFileSync(file, JSON.stringify(data));
	const calls: Array<{ id: string; entry: unknown }> = [];
	const store = {
		record: async (id: string, entry: unknown) => {
			calls.push({ id, entry });
		}
	} as unknown as ReportRepository;
	return { directory, file, calls, store };
}

test('ingest records each Vitest assertion as a check', async () => {
	const fixture = createFixture({
		testResults: [
			{
				name: 'src/parser.test.ts',
				assertionResults: [
					{ fullName: 'parses a report', status: 'passed', duration: 8 },
					{ title: 'rejects invalid input', status: 'failed', duration: 3 }
				]
			}
		]
	});
	try {
		const id = 'report-20261115-0042';
		const input = { id, file: fixture.file };
		const output = await new VitestReportAdapter().ingest(fixture.store, id, fixture.file);
		expect(output).toEqual({ checks: 2 });
		expect(fixture.calls).toEqual([
			{
				id,
				entry: {
					kind: 'check',
					data: {
						id: 'vitest-1',
						title: 'parses a report',
						status: 'passed',
						group: 'src/parser.test.ts',
						durationMs: 8
					}
				}
			},
			{
				id,
				entry: {
					kind: 'check',
					data: {
						id: 'vitest-2',
						title: 'rejects invalid input',
						status: 'failed',
						group: 'src/parser.test.ts',
						durationMs: 3
					}
				}
			}
		]);
		recordExampleCases(
			{
				unitId: 'reports.adapter.vitest-report',
				symbol: 'VitestReportAdapter.ingest',
				state: 'ingest-records-each-vitest-assertion-as-a-check',
				evidence: 'examples-cases',
				file: 'ingest-records-each-vitest-assertion-as-a-check.json'
			},
			[
				{
					name: 'two assertion results become ordered checks',
					input,
					output: { checks: output.checks, records: fixture.calls.map((call) => call.entry) }
				}
			]
		);
	} finally {
		rmSync(fixture.directory, { recursive: true, force: true });
	}
}, 20_000);
