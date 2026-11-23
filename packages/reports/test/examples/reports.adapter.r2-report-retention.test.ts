import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { R2ReportRetentionAdapter } from '../../src/services/reports-media/report-command-service/report-retention-service/R2ReportRetentionAdapter';

function makeAdapter(objects: Array<{ Key: string; LastModified: Date }>) {
	const client = {
		send: async (command: { input: { Prefix?: string } }) => ({
			Contents: objects.filter((object) => object.Key.startsWith(command.input.Prefix ?? '')),
			IsTruncated: false
		})
	};
	return new R2ReportRetentionAdapter(
		{
			accountId: 'example-account',
			accessKeyId: 'example-access-key',
			secretAccessKey: 'example-secret-key',
			bucket: 'example-reports',
			endpoint: 'https://example.invalid'
		},
		client as never
	);
}

test('purge counts matching report objects in a dry run', async () => {
	const id = 'report_20261115_0042';
	const input = { id, dryRun: true };
	const adapter = makeAdapter([
		{ Key: 'report-evidence/runs/report_20261115_0042/a.json', LastModified: new Date(1) },
		{ Key: 'uploaded-screenshots/runs/report_20261115_0042/image.png', LastModified: new Date(1) },
		{ Key: 'published-reports/another-report/report.json', LastModified: new Date(1) }
	]);
	const output = await adapter.purge(input.id, input.dryRun);
	expect(output).toBe(2);
	recordExampleCases(
		{
			unitId: 'reports.adapter.r2-report-retention',
			symbol: 'R2ReportRetentionAdapter.purge',
			state: 'purge-counts-matching-report-objects-in-a-dry-run',
			evidence: 'examples-cases',
			file: 'purge-counts-matching-report-objects-in-a-dry-run.json'
		},
		[{ name: 'two objects under the report prefixes are counted', input, output }]
	);
});

test('orphans counts old unknown report objects in a dry run', async () => {
	const input = { known: ['kept-report'], cutoff: 1800000000000, dryRun: true };
	const adapter = makeAdapter([
		{ Key: 'report-evidence/runs/old-report/result.json', LastModified: new Date(1790000000000) },
		{
			Key: 'uploaded-screenshots/runs/kept-report/image.png',
			LastModified: new Date(1790000000000)
		},
		{ Key: 'published-reports/new-report/report.json', LastModified: new Date(1800000000001) }
	]);
	const output = await adapter.orphans(new Set(input.known), input.cutoff, input.dryRun);
	expect(output).toBe(1);
	recordExampleCases(
		{
			unitId: 'reports.adapter.r2-report-retention',
			symbol: 'R2ReportRetentionAdapter.orphans',
			state: 'orphans-counts-old-unknown-report-objects-in-a-dry-run',
			evidence: 'examples-cases',
			file: 'orphans-counts-old-unknown-report-objects-in-a-dry-run.json'
		},
		[
			{
				name: 'old unknown object is counted while known and newer objects are excluded',
				input,
				output
			}
		]
	);
});
