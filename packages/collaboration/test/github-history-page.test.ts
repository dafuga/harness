import { expect, test } from 'vitest';
import { createGitHubSource } from '../src/utils/create-git-hub-source/createGitHubSource';
import { sourceRepository } from './githubFixture';
const commit = 'a'.repeat(40);
test('owned-path history encodes paths, deduplicates overlap and reports exact pagination without tree fanout', async () => {
	const calls: URL[] = [];
	const adapter = createGitHubSource({
		token: async () => 'fixture',
		fetch: async (input) => {
			const url = new URL(String(input));
			calls.push(url);
			if (url.pathname.endsWith('/source')) return Response.json({ id: 202, private: true });
			if (url.pathname.includes('/git/commits/'))
				return Response.json({ sha: commit, tree: { sha: 'b'.repeat(40) } });
			expect(url.pathname.endsWith('/commits')).toBe(true);
			expect(url.searchParams.get('sha')).toBe(commit);
			expect(url.searchParams.get('per_page')).toBe('2');
			const next = url.searchParams.get('page') === '1';
			return Response.json(
				[
					{
						sha: commit,
						commit: {
							message: 'Changed owned source\nbody',
							author: { date: '2026-10-12' },
							committer: { date: '2026-10-12' }
						}
					}
				],
				{ headers: next ? { link: '<https://api.github.com/next>; rel="next"' } : {} }
			);
		}
	});
	const paths = ['src/a & b.ts', 'src/designs', 'src/a & b.ts'];
	expect(await adapter.historyPage!(sourceRepository, { commit, paths, perPage: 2 })).toEqual({
		commits: [{ hash: commit, subject: 'Changed owned source', authoredAt: '2026-10-12' }],
		complete: false,
		nextPage: 2
	});
	expect(
		calls
			.filter((url) => url.pathname.endsWith('/commits'))
			.map((url) => url.searchParams.get('path'))
	).toEqual(paths.slice(0, 2));
	expect(calls.some((url) => url.href.includes('a%20%26%20b.ts'))).toBe(true);
	expect(
		await adapter.historyPage!(sourceRepository, { commit, paths, page: 2, perPage: 2 })
	).toMatchObject({ complete: true, nextPage: null });
	const count = calls.length;
	await expect(adapter.historyPage!(sourceRepository, { commit: 'main', paths })).rejects.toThrow();
	await expect(
		adapter.historyPage!(sourceRepository, { commit, paths: ['../secret'] })
	).rejects.toThrow();
	await expect(
		adapter.historyPage!(sourceRepository, { commit, paths, perPage: 101 })
	).rejects.toThrow();
	expect(calls).toHaveLength(count);
});
