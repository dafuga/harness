import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { InvalidCleanupTimeError } from '../../src/services/reports-media/InvalidCleanupTimeError';
import { ScreenshotRetentionService } from '../../src/services/reports-media/ScreenshotRetentionService';

const state = 'expires-old-r2-evidence-and-keeps-other-evidence';

function report(id: string, evidence: Array<Record<string, unknown>>) {
	return {
		schemaVersion: 1,
		id,
		project: { id: 'example', name: 'Example', path: '/example' },
		title: 'Example report',
		mode: 'feature',
		environment: 'test',
		historical: false,
		startedAt: '2025-01-01T00:00:00.000Z',
		updatedAt: '2025-01-01T00:00:00.000Z',
		summary: '',
		status: 'passed',
		state: 'finalized',
		checks: [],
		evidence,
		findings: [],
		coverage: [],
		acceptance: []
	};
}

function withTemporaryRepository<T>(run: (service: ScreenshotRetentionService, data: ReturnType<typeof report>[]) => Promise<T>) {
	const root = mkdtempSync(join(tmpdir(), 'screenshot-retention-'));
	const data = [
		report('run-one', [
			{ id: 'old', title: 'Old capture', category: 'screenshot', file: `${'a'.repeat(64)}.png`, status: 'proven', storage: 'r2', capturedAt: '2025-01-01T00:00:00.000Z' },
			{ id: 'new', title: 'Recent capture', category: 'screenshot', file: `${'b'.repeat(64)}.png`, status: 'proven', storage: 'r2', capturedAt: '2025-02-15T00:00:00.000Z' },
			{ id: 'local', title: 'Local capture', category: 'screenshot', file: 'local.png', status: 'proven', storage: 'local', capturedAt: '2025-01-01T00:00:00.000Z' }
		])
	];
	const repository = {
		list: async () => data,
		get: async (id: string) => data.find((item) => item.id === id)!,
		directory: (id: string) => {
			const directory = join(root, id);
			mkdirSync(directory, { recursive: true });
			return directory;
		}
	} as unknown as ConstructorParameters<typeof ScreenshotRetentionService>[0];
	return run(new ScreenshotRetentionService(repository), data).finally(() => rmSync(root, { recursive: true, force: true }));
}

test('Expires old R2 evidence and keeps other evidence', async () => {
	await withTemporaryRepository(async (service, data) => {
		const input = { now: '2025-03-10T00:00:00.000Z' };
		const result = await service.run(new Date(input.now));
		expect(result).toEqual({ expired: 1, reports: 1 });
		expect(data[0].evidence[0]).toMatchObject({ missing: true, status: 'not-proven' });
		recordExampleCases(
			{ unitId: 'reports.service.screenshot-retention', symbol: 'ScreenshotRetentionService.run', state, evidence: 'examples-cases', file: `${state}.json` },
			[{ name: 'expires one old R2 capture while retaining recent and local captures', input, output: { expired: result.expired, reports: result.reports, oldMissing: data[0].evidence[0].missing, recentMissing: data[0].evidence[1].missing ?? false } }]
		);
	});
});

test('Rejects an invalid cleanup time', async () => {
	const state = 'rejects-an-invalid-cleanup-time';
	await withTemporaryRepository(async (service) => {
		let error: unknown;
		try {
			await service.run(new Date(Number.NaN));
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(InvalidCleanupTimeError);
		recordExampleCases(
			{ unitId: 'reports.service.screenshot-retention', symbol: 'ScreenshotRetentionService.run', state, evidence: 'examples-cases', file: `${state}.json` },
			[{ name: 'non-finite cleanup date is rejected', input: { now: 'invalid date' }, error: { name: (error as Error).name, message: (error as Error).message } }]
		);
	});
});
