import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { LegacyHistoryService } from '../../src/cli/program/LegacyHistoryService';

type Media = Parameters<LegacyHistoryService['entries']>[0];

// No evidence tip exists, so the media service is never reached.
const unusedMedia = {} as Media;

test('Returns an empty list when no evidence tip exists', async () => {
	await withTempRepo(async (repository) => {
		const service = new LegacyHistoryService(repository.root);
		const entries = await service.entries(unusedMedia);

		expect(entries).toEqual([]);
		recordExampleCases(
			{
				unitId: 'service.legacy-history',
				symbol: 'entries',
				state: 'returns-an-empty-list-when-no-evidence-tip-exists',
				evidence: 'examples-cases',
				file: 'returns-an-empty-list-when-no-evidence-tip-exists.json'
			},
			[
				{
					name: 'repository without the evidence branch returns no entries',
					input: { root: 'temporary git repository', media: 'not called' },
					output: entries
				}
			]
		);
	});
});
