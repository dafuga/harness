import { expect, test } from 'vitest';
import { createGitHubSource } from '../../src/utils/createGitHubSource';
import { sourceRepository } from '../githubFixture';

const tip = 'a'.repeat(40),
	commit = 'b'.repeat(40),
	other = 'c'.repeat(40);
type Compared = { status: string; base: string } | number;
function fixture(compared: Compared) {
	const paths: string[] = [];
	const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
	const adapter = createGitHubSource({
		token: async () => 'private',
		async fetch(input) {
			const path = new URL(String(input)).pathname;
			paths.push(path);
			if (path.endsWith('/source')) return response({ id: 202, private: true });
			if (typeof compared === 'number') return response({ message: 'No' }, compared);
			return response({ status: compared.status, merge_base_commit: { sha: compared.base } });
		}
	});
	const reaches = () => adapter.reaches?.(sourceRepository, { tip, commit });
	return { adapter, paths, reaches };
}

test('a commit is reached by a tip that is ahead of it or is it', async () => {
	const ahead = fixture({ status: 'ahead', base: commit });
	expect(await ahead.reaches()).toBe(true);
	expect(ahead.paths.at(-1)).toMatch(new RegExp(`/compare/${commit}\\.\\.\\.${tip}$`));
	expect(await fixture({ status: 'identical', base: commit }).reaches()).toBe(true);
	const same = fixture(500);
	expect(await same.adapter.reaches?.(sourceRepository, { tip, commit: tip })).toBe(true);
	expect(same.paths).toEqual([]);
});

test('a tip that is behind, beside or apart from a commit does not reach it', async () => {
	expect(await fixture({ status: 'behind', base: tip }).reaches()).toBe(false);
	expect(await fixture({ status: 'diverged', base: other }).reaches()).toBe(false);
	expect(await fixture({ status: 'ahead', base: other }).reaches()).toBe(false);
	// A commit the repository does not hold is reached by nothing.
	expect(await fixture(404).reaches()).toBe(false);
});

test('an outage is not an answer, and what is no hash is not asked', async () => {
	await expect(fixture(503).reaches()).rejects.toMatchObject({ code: 'github-unavailable' });
	const { adapter, paths } = fixture({ status: 'ahead', base: commit });
	await expect(adapter.reaches?.(sourceRepository, { tip: 'main', commit })).rejects.toMatchObject({
		code: 'invalid-input'
	});
	expect(paths).toEqual([]);
});
