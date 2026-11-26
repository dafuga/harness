import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ReportStorageSyncService } from '../../src/services/reports-media/report-command-service/ReportStorageSyncService';
import type { FakeReport, Repository } from './reports.service.report-storage-sync.test.types';

const HASH_REPLAY = `${'a'.repeat(64)}.mp4`;

function report(id: string, files: string[]): FakeReport {
	return {
		id,
		startedAt: new Date().toISOString(),
		evidence: files.map((file) => ({ file, storage: null, missing: false }))
	};
}

// Fake repository: only the three methods the service calls, backed by made-up reports.
function makeRepository(options: {
	directory: string;
	reports: FakeReport[];
	unavailable?: string[];
}): Repository {
	const unavailable = options.unavailable ?? [];
	return {
		list: async () => options.reports,
		get: async (id: string) => {
			if (unavailable.includes(id)) throw new Error('Report storage is unavailable');
			const found = options.reports.find((item) => item.id === id);
			if (!found) throw new Error(`Report not found: ${id}`);
			return found;
		},
		directory: () => options.directory
	} as unknown as Repository;
}

async function withDir<T>(operation: (directory: string) => Promise<T>): Promise<T> {
	const directory = mkdtempSync(join(tmpdir(), 'report-storage-sync-'));
	try {
		return await operation(directory);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

test('Returns an empty summary when no reports exist', async () => {
	await withDir(async (directory) => {
		const service = new ReportStorageSyncService(makeRepository({ directory, reports: [] }));
		const result = await service.run({});

		expect(result).toEqual({
			reports: [],
			evidence: 0,
			replays: 0,
			skipped: 0,
			errors: [],
			dryRun: false
		});
		recordExampleCases(
			{
				unitId: 'reports.service.report-storage-sync',
				symbol: 'run',
				state: 'returns-an-empty-summary-when-no-reports-exist',
				evidence: 'examples-cases',
				file: 'returns-an-empty-summary-when-no-reports-exist.json'
			},
			[{ name: 'no stored reports yields a zeroed summary', input: {}, output: result }]
		);
	});
});

test('Dry run counts pending evidence and replays without writing', async () => {
	await withDir(async (directory) => {
		mkdirSync(join(directory, 'replays'));
		writeFileSync(join(directory, 'replays', HASH_REPLAY), '');
		writeFileSync(join(directory, 'replays', 'notes.txt'), '');
		const repository = makeRepository({
			directory,
			reports: [report('r1', ['a.png', 'a.png', 'b.png'])]
		});
		const result = await new ReportStorageSyncService(repository).run({ dryRun: true });

		expect(result).toEqual({
			reports: ['r1'],
			evidence: 2,
			replays: 1,
			skipped: 0,
			errors: [],
			dryRun: true
		});
		expect(existsSync(join(directory, 'manifest.json'))).toBe(false);
		recordExampleCases(
			{
				unitId: 'reports.service.report-storage-sync',
				symbol: 'run',
				state: 'dry-run-counts-pending-evidence-and-replays-without-writing',
				evidence: 'examples-cases',
				file: 'dry-run-counts-pending-evidence-and-replays-without-writing.json'
			},
			[
				{
					name: 'dry run counts two distinct pending files and one hash-named replay',
					input: { dryRun: true },
					output: result
				}
			]
		);
	});
});

test('Records a per-report error and keeps other reports', async () => {
	await withDir(async (directory) => {
		const repository = makeRepository({
			directory,
			reports: [report('broken', ['a.png']), report('ok', [])],
			unavailable: ['broken']
		});
		const result = await new ReportStorageSyncService(repository).run({ dryRun: true });

		expect(result.errors).toEqual(['broken: Report storage is unavailable']);
		expect(result.reports).toEqual([]);
		expect(result.evidence).toBe(0);
		recordExampleCases(
			{
				unitId: 'reports.service.report-storage-sync',
				symbol: 'run',
				state: 'records-a-per-report-error-and-keeps-other-reports',
				evidence: 'examples-cases',
				file: 'records-a-per-report-error-and-keeps-other-reports.json'
			},
			[
				{
					name: 'a failing report becomes an errors entry while the others still sync',
					input: { dryRun: true },
					output: result
				}
			]
		);
	});
});

test('Rejects when the selected run cannot be loaded', async () => {
	await withDir(async (directory) => {
		const service = new ReportStorageSyncService(makeRepository({ directory, reports: [] }));
		let error: unknown;
		try {
			await service.run({ run: 'missing', dryRun: true });
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('Report not found: missing');
		recordExampleCases(
			{
				unitId: 'reports.service.report-storage-sync',
				symbol: 'run',
				state: 'rejects-when-the-selected-run-cannot-be-loaded',
				evidence: 'examples-cases',
				file: 'rejects-when-the-selected-run-cannot-be-loaded.json'
			},
			[
				{
					name: 'an unknown run id rejects before per-report error handling starts',
					input: { run: 'missing', dryRun: true },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});
