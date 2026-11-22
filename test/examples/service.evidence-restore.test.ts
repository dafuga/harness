import { test, vi } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { EvidenceRestoreService } from '../../src/services/verification-evidence/EvidenceRestoreService';
import { HistoryNoteRepository } from '../../src/repositories/git-source-history/history-note-repository/HistoryNoteRepository';
import type { Restored } from '../../src/services/verification-evidence/EvidenceRestoreService.types';

const UNIT_ID = 'service.evidence-restore';
const EMPTY_SUMMARY: Restored = { restored: [], skipped: [] };
const EMPTY_STATE = 'restores-nothing-when-history-has-no-attached-records';
const ERROR_STATE = 'throws-error-when-the-history-note-read-rejects';
const READ_FAILURE = 'history note read failed';

test('Restores nothing when history has no attached records', async () => {
	await withTempRepo(async (repository) => {
		const service = new EvidenceRestoreService(repository.root);
		const result = await service.restore();

		expect(result).toEqual(EMPTY_SUMMARY);
		recordExampleCases(
			{
				unitId: UNIT_ID,
				symbol: 'restore',
				state: EMPTY_STATE,
				evidence: 'examples-cases',
				file: `${EMPTY_STATE}.json`
			},
			[
				{
					name: 'empty history returns empty restored and skipped lists',
					input: { root: 'temporary Git repository with no attached records' },
					output: result
				}
			]
		);
	});
});

test('Throws Error when the history note read rejects', async () => {
	await withTempRepo(async (repository) => {
		const service = new EvidenceRestoreService(repository.root);
		const read = vi
			.spyOn(HistoryNoteRepository.prototype, 'verifications')
			.mockRejectedValueOnce(new Error(READ_FAILURE));
		let error: unknown;
		try {
			await service.restore();
		} catch (caught) {
			error = caught;
		} finally {
			read.mockRestore();
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toBe(READ_FAILURE);
		recordExampleCases(
			{
				unitId: UNIT_ID,
				symbol: 'restore',
				state: ERROR_STATE,
				evidence: 'examples-cases',
				file: `${ERROR_STATE}.json`
			},
			[
				{
					name: 'underlying history note read failure is propagated unchanged',
					input: { history: 'note read rejects with an Error' },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});
