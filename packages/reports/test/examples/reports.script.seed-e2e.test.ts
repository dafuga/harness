import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ReportRepository } from '../../src/repositories/reports-media/report-repository/ReportRepository';

function temporaryRoot(): string {
	return mkdtempSync(join(tmpdir(), 'seed-e2e-example-'));
}

test('Seeds a report with check and coverage records', async () => {
	const root = temporaryRoot();
	try {
		const repository = new ReportRepository(root);
		const report = await repository.begin({
			project: join(root, 'sites', 'alpha-project'),
			title: 'Account settings review',
			mode: 'feature',
			environment: 'local fixture',
			acceptance: ['Settings remain readable on mobile']
		});
		await repository.record(report.id, {
			kind: 'check',
			data: { id: 'save', title: 'Save settings', status: 'passed', command: 'bun run check', output: 'passed: 1' }
		});
		await repository.record(report.id, {
			kind: 'coverage',
			data: { id: 'mobile', title: 'Settings', viewport: 'mobile', status: 'blocked', detail: 'Device verification pending' }
		});
		const seeded = await repository.get(report.id);
		expect(seeded.checks.map(({ id }) => id)).toContain('save');
		expect(seeded.coverage.map(({ id }) => id)).toContain('mobile');
		recordExampleCases(
			{
				unitId: 'reports.script.seed-e2e',
				symbol: 'seed-e2e',
				state: 'seeds-a-report-with-check-and-coverage-records',
				evidence: 'examples-cases',
				file: 'seeds-a-report-with-check-and-coverage-records.json'
			},
			[
				{
					name: 'seeds check and coverage records',
					input: { title: 'Account settings review', records: ['check:save', 'coverage:mobile'] },
					output: { checkIds: seeded.checks.map(({ id }) => id), coverageIds: seeded.coverage.map(({ id }) => id) }
				}
			]
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
