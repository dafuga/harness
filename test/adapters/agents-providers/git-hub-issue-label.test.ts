import { expect, test } from 'vitest';
import { GitHubIssueLabelAdapter } from '../../../src/adapters/agents-providers/GitHubIssueLabelAdapter';

function github(status: number, body: object = {}) {
	const calls: string[] = [];
	const adapter = new GitHubIssueLabelAdapter({
		owner: 'acme',
		repo: 'app',
		token: async () => 'test-token',
		fetch: (async (url: URL, init?: RequestInit) => {
			calls.push(`${init?.method} ${String(url)} ${String(init?.body ?? '')}`);
			return Response.json(body, { status });
		}) as unknown as typeof fetch
	});
	return { adapter, calls };
}

test('GitHubIssueLabelAdapter only reads an issue and adds one label', async () => {
	const { adapter, calls } = github(200, { labels: [{ name: 'bug' }] });
	await expect(adapter.labels(5)).resolves.toEqual(['bug']);
	await adapter.addLabel(5, 'approved by Jessel');
	expect(calls).toEqual([
		'GET https://api.github.com/repos/acme/app/issues/5 ',
		'POST https://api.github.com/repos/acme/app/issues/5/labels {"labels":["approved by Jessel"]}'
	]);
});

test('GitHubIssueLabelAdapter ignores pull requests and missing issues', async () => {
	await expect(github(200, { pull_request: {}, labels: [] }).adapter.labels(5)).resolves.toBe(
		undefined
	);
	await expect(github(404).adapter.labels(5)).resolves.toBe(undefined);
	await expect(github(403).adapter.labels(5)).rejects.toThrow('status 403');
	await expect(github(403).adapter.addLabel(5, 'x')).rejects.toThrow('status 403');
});
