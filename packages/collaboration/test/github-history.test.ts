import { expect, test } from 'vitest';
import { createGitHubSource } from '../src/utils/createGitHubSource';
import { sourceRepository } from './githubFixture';
import type { GitHubOptions } from '../src/models/Collaboration.types';
const tip = 'a'.repeat(40),
	parent = 'b'.repeat(40),
	tree = 'c'.repeat(40),
	oldTree = 'd'.repeat(40);
function historyFixture() {
	const state = { refStatus: 200, wrongRef: false, diverged: false, pages: [] as number[] };
	const options: Omit<GitHubOptions, 'repository'> = {
		async token() {
			return 'private';
		},
		async fetch(input) {
			const url = new URL(String(input)),
				path = url.pathname;
			const response = (data: unknown, status = 200) =>
				new Response(JSON.stringify(data), { status });
			if (path.endsWith('/source')) return response({ id: 202, private: true });
			if (path.includes('/git/matching-refs/'))
				return response(
					[
						{
							ref: state.wrongRef
								? 'refs/notes/harness-extra'
								: `refs/${path.split('/git/matching-refs/')[1]}`,
							object: { sha: tip }
						}
					],
					state.refStatus
				);
			if (path.includes('/git/ref/'))
				return response(
					{
						ref: state.wrongRef ? 'refs/notes/harness-extra' : `refs/${path.split('/git/ref/')[1]}`,
						object: { sha: tip }
					},
					state.refStatus
				);
			if (path.includes('/git/commits/') || path.includes('/git/trees/'))
				return objectResponse(path);
			if (path.includes('/compare/'))
				return response({
					status: state.diverged ? 'diverged' : 'ahead',
					merge_base_commit: { sha: parent }
				});
			return listResponse(state, url);
		}
	};
	return { state, adapter: createGitHubSource(options) };
}
test('history paginates branch and commit ancestry, resolves exact optional refs, compares first-parent trees', async () => {
	const { state, adapter } = historyFixture();
	expect(await adapter.branches(sourceRepository)).toHaveLength(101);
	expect(
		(await adapter.commits(sourceRepository, { branch: 'feature/last', commit: parent }))[0]
	).toMatchObject({ subject: 'Commit 0', authoredAt: '2026-10-12T00:00:00Z' });
	expect(state.pages).toEqual([1, 2, 1, 2]);
	expect(await adapter.changed(sourceRepository, tip)).toEqual(['added.ts', 'removed.ts']);
	expect(await adapter.optionalRef(sourceRepository, 'refs/notes/harness')).toEqual({
		commit: tip,
		tree
	});
	state.wrongRef = true;
	await expect(adapter.optionalRef(sourceRepository, 'refs/notes/harness')).rejects.toMatchObject({
		code: 'ref-mismatch'
	});
	state.refStatus = 404;
	expect(await adapter.optionalRef(sourceRepository, 'refs/notes/missing')).toBeNull();
	state.refStatus = 403;
	await expect(adapter.optionalRef(sourceRepository, 'refs/notes/missing')).rejects.toMatchObject({
		code: 'github-unavailable'
	});
	state.refStatus = 200;
	state.wrongRef = false;
	state.diverged = true;
	await expect(
		adapter.commits(sourceRepository, { branch: 'main', commit: parent })
	).rejects.toMatchObject({ code: 'unreachable-anchor' });
});

function listResponse(state: { pages: number[] }, url: URL) {
	const path = url.pathname;
	const response = (data: unknown) => new Response(JSON.stringify(data));
	const page = Number(url.searchParams.get('page'));
	state.pages.push(page);
	if (path.endsWith('/branches'))
		return response(
			page === 1
				? Array.from({ length: 100 }, (_, i) => ({
						name: `feature/${i}`,
						commit: { sha: tip }
					}))
				: [{ name: 'feature/last', commit: { sha: parent } }]
		);
	return response(
		page === 1
			? Array.from({ length: 100 }, (_, i) => ({
					sha: i.toString(16).padStart(40, '0'),
					commit: {
						message: `Commit ${i}\nbody`,
						author: { date: '2026-10-12T00:00:00Z' },
						committer: { date: '2026-10-12T00:00:00Z' }
					}
				}))
			: []
	);
}

function objectResponse(path: string) {
	const response = (data: unknown) => new Response(JSON.stringify(data));
	if (path.includes('/git/commits/')) {
		const hash = path.endsWith(parent) ? parent : tip;
		return response({
			sha: hash,
			tree: { sha: hash === tip ? tree : oldTree },
			parents: hash === tip ? [{ sha: parent }] : []
		});
	}
	if (path.includes('/git/trees/'))
		return response({
			sha: path.split('/').at(-1),
			truncated: false,
			tree: [
				{
					path: path.includes(oldTree) ? 'removed.ts' : 'added.ts',
					type: 'blob',
					sha: 'f'.repeat(40),
					mode: '100644'
				}
			]
		});

	return response({});
}
