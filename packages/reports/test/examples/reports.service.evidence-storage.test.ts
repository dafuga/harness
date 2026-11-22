import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { EvidenceStorageService } from '../../src/services/verification-evidence/EvidenceStorageService';
import { ReportExpiredError } from '../../src/services/verification-evidence/EvidenceStorageService.types';

type Report = Parameters<EvidenceStorageService['store']>[0];

const RECENT = '2026-11-12T09:14:05.318Z';
const EXPIRED = '2026-09-01T00:00:00.000Z';
const INVALID = 'not-a-date';
const PNG = '4f1e8a2c9d7b3e60a51f8c2d9b4e7a13f6c0d85b2e9a4f7c1d3b6e8a0c5f2d91.png';
const WAV = '2b7e9d4a1f6c83e0b5d2a7f9c4e1b6d8a3f0c7e2b9d5a1f4c6e8b3d0a7f2c951.wav';

const service = new EvidenceStorageService();

function pendingItem(file: string): Report['evidence'][number] {
	return {
		id: `item-${file.slice(0, 8)}`,
		title: 'Payment retry narration',
		category: 'Uploaded audio',
		file,
		status: 'not-proven',
		source: 'Manual audio upload · recording date not supplied',
		mediaType: 'audio',
		mimeType: 'audio/wav'
	};
}

function storedItem(): Report['evidence'][number] {
	return { ...pendingItem(PNG), id: 'stored-item', storage: 'r2' };
}

function missingItem(): Report['evidence'][number] {
	return { ...pendingItem(WAV), id: 'missing-item', missing: true };
}

function reportWith(startedAt: string, evidence: Report['evidence']): Report {
	return {
		schemaVersion: 1,
		id: '5b1e0c7a-3d2f-4a8e-9c61-0f7b2d4e8a13',
		project: { id: '9a3f0c2d5e7b1a48', name: 'storefront', path: '/workspace/project' },
		title: 'Payment retry',
		mode: 'feature',
		environment: 'local',
		historical: false,
		startedAt,
		updatedAt: '2026-11-14T11:20:09.037Z',
		summary: 'Payment retry path re-checked after the fix.',
		status: 'running',
		state: 'active',
		checks: [],
		evidence,
		findings: [],
		coverage: [],
		acceptance: []
	};
}

async function withRunDirectory<T>(run: (directory: string) => Promise<T>): Promise<T> {
	const directory = mkdtempSync(join(tmpdir(), 'evidence-storage-'));
	try {
		return await run(directory);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

async function failureOf(run: () => Promise<void>): Promise<unknown> {
	try {
		await run();
	} catch (caught) {
		return caught;
	}
	return undefined;
}

function meta(state: string) {
	return {
		unitId: 'reports.service.evidence-storage',
		symbol: 'store',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Returns without storing when no evidence is pending', async () => {
	await withRunDirectory(async (directory) => {
		const report = reportWith(RECENT, [storedItem(), missingItem()]);
		const result = await service.store(report, directory);

		expect(result).toBeUndefined();
		expect(report.evidence.map((item) => item.storage ?? null)).toEqual(['r2', null]);
		recordExampleCases(meta('returns-without-storing-when-no-evidence-is-pending'), [
			{
				name: 'stored and missing items are skipped and nothing is uploaded',
				input: { startedAt: RECENT, items: ['stored', 'missing'] },
				output: {
					resolved: result === undefined,
					storage: report.evidence.map((item) => item.storage ?? null)
				}
			}
		]);
	});
});

test('Rejects an expired report before any upload', async () => {
	await withRunDirectory(async (directory) => {
		const report = reportWith(EXPIRED, [pendingItem(PNG)]);
		const error = await failureOf(() => service.store(report, directory));

		expect(error).toBeInstanceOf(ReportExpiredError);
		expect((error as Error).message).toBe('Report expired after 30 days; create a new report');
		expect(report.evidence[0]?.storage).toBeUndefined();
		recordExampleCases(meta('rejects-an-expired-report-before-any-upload'), [
			{
				name: 'report started 2026-09-01 with one pending item rejects as expired',
				input: { startedAt: EXPIRED, pending: 1 },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]);
	});
});

test('Rejects a report whose start time does not parse', async () => {
	await withRunDirectory(async (directory) => {
		const report = reportWith(INVALID, [pendingItem(PNG)]);
		const error = await failureOf(() => service.store(report, directory));

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('Invalid report retention timestamp');
		recordExampleCases(meta('rejects-a-report-whose-start-time-does-not-parse'), [
			{
				name: 'unparseable startedAt with one pending item rejects before any upload',
				input: { startedAt: INVALID, pending: 1 },
				error: { name: (error as Error).name, message: (error as Error).message }
			}
		]);
	});
});
