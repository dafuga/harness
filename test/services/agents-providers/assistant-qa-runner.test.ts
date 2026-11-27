import { afterEach, expect, test, vi } from 'vitest';
import type { GitHubAppAdapter } from '../../../src/adapters/agents-providers/GitHubAppAdapter';
import { qaDeployedRevision } from '../../../src/workflows/agents-providers/run-assistant/qaDeployedRevision';
import { qaLabelEvents } from '../../../src/workflows/agents-providers/run-assistant/qaLabelEvents';

const sha = '0123456789abcdef0123456789abcdef01234567';
const repoPath = '/repos/o/r';
const config = {
	channel: 'CQA',
	label: 'needs testing on staging',
	stagingUrl: 'https://staging.test',
	checkName: 'Cloudflare Pages',
	checkApp: 'pages',
	healthTarget: 'cloudflare'
};
const health = config.stagingUrl + '/api/health';

afterEach(() => vi.unstubAllGlobals());

test('requires a successful exact-revision Pages check, target health and a stable branch', async () => {
	const read = vi.fn(async (path: string) =>
		path.includes('branches')
			? { commit: { sha } }
			: {
					check_runs: [
						{
							head_sha: sha,
							conclusion: 'success',
							app: { slug: 'pages' },
							output: {
								summary:
									"<a href='https://staging.test'>https://staging.test</a> <code>0123456</code>"
							}
						}
					]
				}
	);
	const github = { repoPath, read } as unknown as GitHubAppAdapter;
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => Response.json({ ok: true, target: 'cloudflare' }))
	);
	await expect(qaDeployedRevision(github, 'staging', config, health)).resolves.toBe(sha);
	expect(read.mock.calls.map(([path]) => path)).toEqual([
		repoPath + '/branches/staging',
		repoPath + '/commits/' + sha + '/check-runs',
		repoPath + '/branches/staging'
	]);
	await expect(
		qaDeployedRevision(github, 'staging', { ...config, checkApp: 'other' }, health)
	).resolves.toBeUndefined();
	read.mockImplementationOnce(async () => ({ commit: { sha: 'a'.repeat(40) } }));
	await expect(qaDeployedRevision(github, 'staging', config, health)).resolves.toBeUndefined();
});

test('only selects current labels on new QA threads at or after cutover', async () => {
	const label = { name: config.label };
	const since = '2026-11-27T10:00:00Z';
	const event = (id: number, event: string, created_at = since) => ({
		id,
		event,
		created_at,
		label
	});
	const responses = new Map([
		[
			repoPath + '/issues',
			[{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4, pull_request: {} }, { number: 5 }]
		],
		[repoPath + '/issues/1/events', [event(1, 'unlabeled'), event(2, 'labeled')]],
		[repoPath + '/issues/2/events', [event(3, 'labeled'), event(4, 'unlabeled')]],
		[repoPath + '/issues/3/events', [event(5, 'labeled', '2026-11-26T10:00:00Z')]]
	] as Array<[string, object[]]>);
	const read = vi.fn(async (path: string) => {
		const response = responses.get(path);
		if (!response) throw new Error('Unexpected path.');
		return response;
	});
	const github = { repoPath, read } as unknown as GitHubAppAdapter;
	await expect(qaLabelEvents(github, label.name, since, [5])).resolves.toEqual([
		{ eventId: '2', issue: 1 }
	]);
});
