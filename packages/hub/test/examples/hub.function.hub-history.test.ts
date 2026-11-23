import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { hubHistory } from '../../src/utils/git-source-history/hubHistory';
import type { HubSourceContext } from '../../src/utils/development-tooling/hubSource';

const repository = { kind: 'git', url: 'https://example.invalid/project.git' };
const commit = 'a1b2c3d4e5f678901234567890abcdef12345678';

function contextFor(historyPage?: (...args: never[]) => unknown) {
	return {
		source: { historyPage },
		repository,
		commit,
		entries: [],
		identity: {},
		cache: {}
	} as unknown as HubSourceContext;
}

test('Reads and orders a source history page', async () => {
	const requested: unknown[] = [];
	const context = contextFor((...args: never[]) => {
		requested.push(args);
		return Promise.resolve({
			complete: false,
			nextPage: 2,
			commits: [
				{ hash: 'older', authoredAt: '2026-11-13T12:00:00.000Z', subject: 'Older change' },
				{
					hash: 'newer',
					authoredAt: '2026-11-14T12:30:00.000Z',
					subject: 'Update hosted history reader'
				}
			]
		});
	});
	const input = {
		branch: 'main',
		paths: ['packages/hub/src/utils/git-source-history/hubHistory.ts'],
		page: 2
	};
	const result = await hubHistory(context, input);
	expect(result.entries.map((entry) => entry.id)).toEqual(['newer', 'older']);
	expect(requested).toEqual([[repository, { commit, paths: input.paths, page: 2, perPage: 20 }]]);
	recordExampleCases(
		{
			unitId: 'hub.function.hub-history',
			symbol: 'hubHistory',
			state: 'reads-and-orders-a-source-history-page',
			evidence: 'examples-cases',
			file: 'reads-and-orders-a-source-history-page.json'
		},
		[{ name: 'page two with newest commit first', input, output: result }]
	);
});

test('Reports unavailable source history', async () => {
	const input = { paths: ['packages/hub/src/index.ts'] };
	let error: unknown;
	try {
		await hubHistory(contextFor(), input);
	} catch (caught) {
		error = caught;
	}
	expect(error).toMatchObject({ code: 'history-unavailable' });
	recordExampleCases(
		{
			unitId: 'hub.function.hub-history',
			symbol: 'hubHistory',
			state: 'reports-unavailable-source-history',
			evidence: 'examples-cases',
			file: 'reports-unavailable-source-history.json'
		},
		[{ name: 'adapter omits historyPage', input, error: { code: 'history-unavailable' } }]
	);
});
