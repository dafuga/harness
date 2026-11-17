import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { EvidenceRestoreService } from '../../src/services/verification-evidence/EvidenceRestoreService';
import type { Restored } from '../../src/services/verification-evidence/EvidenceRestoreService.types';

test('Restores nothing when history has no attached records', async () => {
	await withTempRepo(async (repository) => {
		const restored: Restored = await new EvidenceRestoreService(repository.root).restore();

		expect(restored).toEqual({ restored: [], skipped: [] });
		recordExampleCases(
			{
				unitId: 'service.evidence-restore',
				symbol: 'restore',
				state: 'restores-nothing-when-history-has-no-attached-records',
				evidence: 'examples-cases',
				file: 'restores-nothing-when-history-has-no-attached-records.json'
			},
			[
				{
					name: 'empty history in a fresh temporary repository adds nothing',
					input: { root: 'temporary Git repository with no attached records' },
					output: restored
				}
			]
		);
	});
});
