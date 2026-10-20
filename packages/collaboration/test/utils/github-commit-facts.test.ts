import { expect, test } from 'vitest';
import { createGitHubSource } from '../../src/utils/create-git-hub-source/createGitHubSource';
import { sourceRepository } from '../githubFixture';

const commit = 'a'.repeat(40),
	first = 'b'.repeat(40),
	second = 'c'.repeat(40),
	tree = 'd'.repeat(40),
	absent = 'e'.repeat(40);
const stated = {
	sha: commit,
	tree: { sha: tree },
	parents: [{ sha: first }, { sha: second }],
	message: 'feat: change titles\nacross two lines\n\nThe body is not the subject.\n',
	author: { name: 'Ada', email: 'ada@example.test', date: '2026-10-12T07:00:00Z' },
	committer: { name: 'Bot', email: 'bot@example.test', date: '2026-10-12T08:00:00Z' }
};
function fixture() {
	const state = { id: 202, status: 200, sha: commit, paths: [] as string[] };
	const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
	const adapter = createGitHubSource({
		token: async () => 'private',
		async fetch(input) {
			const path = new URL(String(input)).pathname;
			state.paths.push(path);
			if (path.endsWith('/source')) return response({ id: state.id, private: true });
			if (path.endsWith(`/git/commits/${commit}`))
				return response({ ...stated, sha: state.sha }, state.status);
			return response({ message: 'Not Found' }, 404);
		}
	});
	return { state, adapter };
}

test('a commit is stated with its tree, its parents in order, its title and who committed when', async () => {
	const { adapter, state } = fixture();
	expect(await adapter.facts?.(sourceRepository, commit)).toEqual({
		commit,
		tree,
		parents: [first, second],
		subject: 'feat: change titles across two lines',
		author: 'Ada',
		committedAt: '2026-10-12T08:00:00Z'
	});
	expect(state.paths.filter((path) => path.includes('/git/commits/'))).toHaveLength(1);
});

test('a commit the repository does not hold is none, and nothing is read for what is no hash', async () => {
	const { adapter, state } = fixture();
	expect(await adapter.facts?.(sourceRepository, absent)).toBeNull();
	const before = state.paths.length;
	await expect(adapter.facts?.(sourceRepository, 'refs/heads/main')).rejects.toMatchObject({
		code: 'invalid-input'
	});
	expect(state.paths.length).toBe(before);
});

test('another repository, another commit than the one asked for and an outage are all refused', async () => {
	const moved = fixture();
	moved.state.id = 303;
	await expect(moved.adapter.facts?.(sourceRepository, commit)).rejects.toMatchObject({
		code: 'repository-denied'
	});
	const other = fixture();
	other.state.sha = absent;
	await expect(other.adapter.facts?.(sourceRepository, commit)).rejects.toMatchObject({
		code: 'commit-mismatch'
	});
	const down = fixture();
	down.state.status = 503;
	await expect(down.adapter.facts?.(sourceRepository, commit)).rejects.toMatchObject({
		code: 'github-unavailable'
	});
});
