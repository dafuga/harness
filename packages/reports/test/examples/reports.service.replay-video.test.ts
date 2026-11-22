import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { ReplayVideoService } from '../../src/routes/api/replay-video/replay-video-service/ReplayVideoService';
import { ReportRepository } from '../../src/repositories/reports-media/report-repository/ReportRepository';

test('Rejects replay creation for an expired report', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'replay-video-expired-'));
	try {
		const repository = new ReportRepository(directory);
		repository.get = async () => ({ startedAt: '2000-01-01T00:00:00.000Z' }) as never;
		repository.directory = () => directory;
		let error: unknown;
		try {
			await new ReplayVideoService(repository).create('report-123');
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe('Report expired after 30 days');
		recordExampleCases(
			{
				unitId: 'reports.service.replay-video',
				symbol: 'create',
				state: 'rejects-replay-creation-for-an-expired-report',
				evidence: 'examples-cases',
				file: 'rejects-replay-creation-for-an-expired-report.json'
			},
			[
				{
					name: 'an expired report is rejected before replay files are accessed',
					input: { id: 'report-123', startedAt: '2000-01-01T00:00:00.000Z' },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
