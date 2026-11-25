import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ReplayStorageService } from '../../src/services/reports-media/ReplayStorageService';
import { ReplayStorageError } from '../../src/services/reports-media/ReplayStorageService.types';
import type { Report } from './reports.service.replay-storage.test.types';

const UNIT = 'reports.service.replay-storage';
const REPORT_ID = '378413ad-29d3-4b7c-be71-828250cf0123';
const REPLAY_FILE = '7e6cc9f9b0915b43a671b5a7eecc37b2c1d87729b8a433893ba0aa4f9f2689ef.mp4';
const EXPIRED_AT = '2026-01-01T00:00:00.000Z';
const created: string[] = [];

afterEach(() => {
	for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), 'replay-storage-'));
	created.push(dir);
	return dir;
}

function reportStartedAt(startedAt: string): Report {
	return {
		schemaVersion: 1,
		id: REPORT_ID,
		project: { id: '357f144b4cee261e', name: 'project', path: '/workspace/project' },
		title: 'Replay storage verification',
		mode: 'feature',
		environment: 'local',
		historical: false,
		startedAt,
		updatedAt: startedAt,
		summary: '',
		status: 'running',
		state: 'active',
		checks: [],
		evidence: [],
		findings: [],
		coverage: [],
		acceptance: []
	};
}

async function failureOf(run: () => Promise<unknown>): Promise<unknown> {
	try {
		await run();
	} catch (error) {
		return error;
	}
	return undefined;
}

function errorSummary(error: unknown) {
	return { name: (error as Error).name, message: (error as Error).message };
}

test('Rejects a report that expired after 30 days', async () => {
	const service = new ReplayStorageService();
	const expired = reportStartedAt(EXPIRED_AT);
	const error = await failureOf(() => service.store(expired, tempDir(), REPLAY_FILE));

	expect(error).toBeInstanceOf(ReplayStorageError);
	expect((error as Error).message).toBe('Report expired after 30 days');
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'store',
			state: 'rejects-a-report-that-expired-after-30-days',
			evidence: 'examples-cases',
			file: 'rejects-a-report-that-expired-after-30-days.json'
		},
		[
			{
				name: 'store with a report started 2026-01-01 rejects as expired',
				input: { reportId: REPORT_ID, file: REPLAY_FILE, startedAt: EXPIRED_AT },
				error: errorSummary(error)
			}
		]
	);
});

test('Restores nothing when the report directory has no receipt', async () => {
	const service = new ReplayStorageService();
	const recent = reportStartedAt(new Date().toISOString());
	const restored = await service.restore(recent, tempDir(), REPLAY_FILE);

	expect(restored).toBeUndefined();
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'restore',
			state: 'restores-nothing-when-the-report-directory-has-no-receipt',
			evidence: 'examples-cases',
			file: 'restores-nothing-when-the-report-directory-has-no-receipt.json'
		},
		[
			{
				name: 'restore of an empty run directory resolves to undefined',
				input: { reportId: REPORT_ID, file: REPLAY_FILE },
				output: { value: 'undefined' }
			}
		]
	);
});

test('Rejects a restore from a symlinked report directory', async () => {
	const service = new ReplayStorageService();
	const root = tempDir();
	const link = join(root, 'run');
	symlinkSync(root, link);
	const recent = reportStartedAt(new Date().toISOString());
	const error = await failureOf(() => service.restore(recent, link, REPLAY_FILE));

	expect(error).toBeInstanceOf(ReplayStorageError);
	expect((error as Error).message).toBe('Invalid replay directory');
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'restore',
			state: 'rejects-a-restore-from-a-symlinked-report-directory',
			evidence: 'examples-cases',
			file: 'rejects-a-restore-from-a-symlinked-report-directory.json'
		},
		[
			{
				name: 'restore through a symlinked run directory rejects before any fetch',
				input: { reportId: REPORT_ID, file: REPLAY_FILE, directory: 'symlink to report root' },
				error: errorSummary(error)
			}
		]
	);
});

test('Rejects a restore with a non-digest replay filename', async () => {
	const service = new ReplayStorageService();
	const badFile = 'not-a-digest.mp4';
	const recent = reportStartedAt(new Date().toISOString());
	const error = await failureOf(() => service.restore(recent, tempDir(), badFile));

	expect(error).toBeInstanceOf(Error);
	recordExampleCases(
		{
			unitId: UNIT,
			symbol: 'restore',
			state: 'rejects-a-restore-with-a-non-digest-replay-filename',
			evidence: 'examples-cases',
			file: 'rejects-a-restore-with-a-non-digest-replay-filename.json'
		},
		[
			{
				name: 'restore with a non-digest replay filename rejects on the R2 key check',
				input: { reportId: REPORT_ID, file: badFile },
				error: errorSummary(error)
			}
		]
	);
});
