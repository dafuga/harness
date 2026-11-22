import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ReportRetentionService } from '../../src/services/reports-media/report-command-service/report-retention-service/ReportRetentionService';

type Repository = NonNullable<ConstructorParameters<typeof ReportRetentionService>[0]>;

// A minimal repository stand-in: the service only reads root, directory(), list() and get().
function fakeRepository(root: string): Repository {
	return {
		root,
		directory: (id: string) => join(root, 'reports', id),
		list: async () => [],
		get: async () => {
			throw new Error('no reports in this fixture');
		}
	} as unknown as Repository;
}

test('Plans no reports for an empty repository in dry-run', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'report-retention-empty-'));
	try {
		const service = new ReportRetentionService(fakeRepository(directory));
		const result = await service.run({ dryRun: true });

		expect(result.plannedReports).toEqual([]);
		expect(result.deletedReports).toEqual([]);
		expect(result.errors).toEqual([]);
		expect(result.dryRun).toBe(true);
		recordExampleCases(
			{
				unitId: 'reports.service.report-retention',
				symbol: 'run',
				state: 'plans-no-reports-for-an-empty-repository-in-dry-run',
				evidence: 'examples-cases',
				file: 'plans-no-reports-for-an-empty-repository-in-dry-run.json'
			},
			[
				{
					name: 'empty root with dryRun true plans and deletes nothing',
					input: { dryRun: true },
					output: {
						plannedReports: result.plannedReports,
						deletedReports: result.deletedReports,
						errors: result.errors,
						dryRun: result.dryRun
					}
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Rejects when the report cleanup root is a symbolic link', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'report-retention-link-'));
	try {
		const real = join(directory, 'real');
		const link = join(directory, 'link');
		mkdirSync(real);
		symlinkSync(real, link);
		const service = new ReportRetentionService(fakeRepository(link));
		let error: unknown;
		try {
			await service.run({ dryRun: true });
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('Invalid report cleanup root');
		recordExampleCases(
			{
				unitId: 'reports.service.report-retention',
				symbol: 'run',
				state: 'rejects-when-the-report-cleanup-root-is-a-symbolic-link',
				evidence: 'examples-cases',
				file: 'rejects-when-the-report-cleanup-root-is-a-symbolic-link.json'
			},
			[
				{
					name: 'symlinked root rejects before any report is listed',
					input: { root: 'link', dryRun: true },
					error: {
						name: (error as Error).name,
						message: (error as Error).message
					}
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test('Records a mismatched orphan receipt as an error', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'report-retention-receipt-'));
	try {
		mkdirSync(join(directory, 'publications'));
		writeFileSync(
			join(directory, 'publications', 'run-a.json'),
			JSON.stringify({ run: 'run-b', publishedAt: '2020-01-01T00:00:00.000Z' })
		);
		const service = new ReportRetentionService(fakeRepository(directory));
		const result = await service.run({ dryRun: true });

		expect(result.errors).toEqual(['Invalid orphan publication receipt']);
		expect(result.deletedReports).toEqual([]);
		expect(result.dryRun).toBe(true);
		recordExampleCases(
			{
				unitId: 'reports.service.report-retention',
				symbol: 'run',
				state: 'records-a-mismatched-orphan-receipt-as-an-error',
				evidence: 'examples-cases',
				file: 'records-a-mismatched-orphan-receipt-as-an-error.json'
			},
			[
				{
					name: 'orphan receipt naming another run is collected, not thrown',
					input: { dryRun: true, receipt: { file: 'run-a.json', run: 'run-b' } },
					output: { errors: result.errors, deletedReports: result.deletedReports }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
