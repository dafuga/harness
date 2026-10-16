import { expect, test } from 'vitest';
import { hubHistory } from '../../src/utils/hubHistory';
import { hubSource } from '../../src/utils/hubSource';
import { actor, project, commit, projectionFixture } from '../support/projectionFixture';
test('history uses bounded owned paths with explicit pagination', async () => {
	const f = projectionFixture(),
		seen: unknown[] = [];
	f.source.historyPage = async (_repo, input) => {
		seen.push(input);
		return {
			commits: [{ hash: commit, subject: 'feat: changed', authoredAt: '2026-10-12T00:00:00Z' }],
			complete: false,
			nextPage: 2
		};
	};
	f.source.changed = () => {
		throw Error('Unbounded tree fanout forbidden');
	};
	const context = await hubSource({
		source: f.source,
		cache: f.cache,
		actor,
		project,
		ref: commit
	});
	const page = await hubHistory(context, { paths: ['src/example.ts'], page: 1 });
	expect(seen).toEqual([{ commit, paths: ['src/example.ts'], page: 1, perPage: 20 }]);
	expect(page.entries[0].commit).toBe(commit);
	expect(page).toMatchObject({ complete: false, nextPage: 2 });
});
