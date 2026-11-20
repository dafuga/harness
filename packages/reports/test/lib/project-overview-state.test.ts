import { describe, expect, it } from 'vitest';
import { readProjectOverview } from '../../src/lib/projects-sessions/project-overview/readProjectOverview';
import { sanitizeText } from '../../src/lib/projects-sessions/project-overview/projectOverviewPrivacy';
import { NOW, jsonReply, syntheticTrackerFetch } from './project-overview-fixtures';
import { item } from './project-overview-item-fixtures';

/** Credential forms the sanitizer must redact, with their exact sanitized text. */
const CREDENTIAL_CASES: [string, string, string][] = [
	['quoted password with spaces', 'password = "two words here"', '[redacted]'],
	['single-quoted token', "token: 'abc def ghi'", '[redacted]'],
	['JSON api_key field', '{"api_key":"abc123xyz"}', '{"[redacted]}'],
	['JSON camelCase field', '{"accessToken": "tok-123"}', '{"[redacted]}'],
	[
		'URL code parameter',
		'https://example.invalid/hook?code=abc123&x=1',
		'https://example.invalid/hook[redacted]&x=1'
	],
	[
		'URL access_token parameter',
		'https://example.invalid/cb?access_token=zzz&state=ok',
		'https://example.invalid/cb[redacted]&state=ok'
	],
	['Authorization Basic header', 'Authorization: Basic dXNlcjpwYXNz', '[redacted]'],
	['Authorization Bearer header', 'Authorization: Bearer abc.def.ghi', '[redacted]'],
	['padded Basic value', 'Basic dXNlcjpwYXNzd29yZA==', '[redacted]'],
	['JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl', '[redacted]'],
	['environment assignment', 'DB_PASSWORD=hunter2 run', '[redacted] run'],
	['access key assignment', 'accessKey=AKIAABCDEFGHIJKLMNOP', '[redacted]'],
	[
		'GitHub token in a note',
		'Checked CI with ghp_abcdefghijklmnopqrstuvwxyz0123456789',
		'Checked CI with [redacted]'
	],
	['labelled password', 'mb2 password: hunter22', 'mb2 [redacted]'],
	['URL token query', 'box?token=abc123def456', 'box?[redacted]'],
	// Deliberate over-match: a "Token:" label is treated as a credential, so its next word also goes.
	['conservative token label', 'Token: refresh flow', '[redacted] flow']
];

/** Public titles with credential-like words that must stay readable. */
const PUBLIC_TITLES = [
	'Pick Stripe or Paddle?',
	'Rotate logs',
	'Secretary: Ann',
	'Needs API key from vendor',
	'Write token economy docs',
	'Basic security review',
	'api key: rotate',
	'private key: rotate'
];

/** Two items whose raw agent names carry credential-shaped labels; cards keep them as sanitized text. */
function displayLabelItems(): Record<string, unknown>[] {
	return [
		item({
			agent: 'ops password: hunter22',
			id: 'c1',
			status: 'in_progress',
			title: 'Rotate {"api_key":"abc123xyz"} config',
			updated: '2026-11-20T19:41:00.000Z'
		}),
		item(
			{
				agent: 'ops password: hunter22',
				id: 'c2',
				status: 'blocked',
				title: 'Connect vendor',
				updated: '2026-11-20T18:41:00.000Z'
			},
			{ extra: { blocked_reason: 'Authorization: Basic dXNlcjpwYXNz' } }
		)
	];
}

/** Tracker replies for the display-label case: a credential-shaped raw node name in runs and machines. */
function displayLabelReplies() {
	return {
		items: jsonReply(displayLabelItems()),
		runs: jsonReply([
			{ id: 1, node: 'box', item_id: 'c1', state: 'running' },
			{ id: 2, node: 'mb2 token=abc123def456', item_id: 'c1', state: 'running' }
		]),
		machines: jsonReply([
			{ node: 'box', status: 'ok' },
			{ node: 'mb2 token=abc123def456', status: 'offline' }
		])
	};
}

/** The exact snapshot for the display-label case: labels sanitized, joins made on raw node names. */
const DISPLAY_LABEL_SNAPSHOT = {
	status: 'ready',
	liveSessions: 1,
	machines: [
		{ name: 'box', status: 'ok' },
		{ name: 'mb2 [redacted]', status: 'offline' }
	],
	projects: [
		{
			agent: 'ops [redacted]',
			state: 'active',
			liveSessions: 1,
			counts: { open: 0, in_progress: 1, blocked: 1, done: 0 },
			items: [
				{
					id: 'c1',
					title: 'Rotate {"[redacted]} config',
					status: 'in_progress',
					updatedAt: '2026-11-20T19:41:00.000Z',
					due: null,
					live: true,
					stale: false
				}
			],
			attention: null,
			blocked: {
				item: {
					id: 'c2',
					title: 'Connect vendor',
					status: 'blocked',
					updatedAt: '2026-11-20T18:41:00.000Z',
					due: null,
					live: false,
					stale: false
				},
				text: '[redacted]'
			},
			milestone: null,
			updatedAt: '2026-11-20T19:41:00.000Z'
		}
	]
};

/** Two open items under agent names that share one display label but differ in raw form. */
function sameLabelItems(): Record<string, unknown>[] {
	return [
		item({
			agent: 'ops password: hunter22',
			id: 'o1',
			status: 'open',
			title: 'First open',
			updated: '2026-11-20T10:00:00.000Z'
		}),
		item({
			agent: 'ops password: hunter23',
			id: 'o2',
			status: 'open',
			title: 'Second open',
			updated: '2026-11-20T11:00:00.000Z'
		})
	];
}

describe('sanitizeText credential matrix', () => {
	it.each(CREDENTIAL_CASES)('redacts %s', (_label, input, output) => {
		expect(sanitizeText(input)).toBe(output);
	});

	it.each(PUBLIC_TITLES)('keeps the public text %s', (title) => {
		expect(sanitizeText(title)).toBe(title);
	});
});

describe('readProjectOverview display labels', () => {
	it('sanitizes agent and machine labels, while run joins and offline checks use raw names', async () => {
		const { fetcher } = syntheticTrackerFetch(displayLabelReplies());

		const snapshot = await readProjectOverview(fetcher, NOW);

		expect(snapshot).toStrictEqual(DISPLAY_LABEL_SNAPSHOT);
		const text = JSON.stringify(snapshot);
		for (const leak of ['abc123xyz', 'hunter22', 'dXNlcjpwYXNz', 'abc123def456']) {
			expect(text).not.toContain(leak);
		}
	});

	it('groups cards by the raw agent even when two raw names share one display label', async () => {
		const { fetcher } = syntheticTrackerFetch({ items: jsonReply(sameLabelItems()) });

		const snapshot = await readProjectOverview(fetcher, NOW);

		expect(snapshot.status).toBe('ready');
		if (snapshot.status !== 'ready') return;
		expect(snapshot.projects.map((card) => card.agent)).toStrictEqual([
			'ops [redacted]',
			'ops [redacted]'
		]);
		expect(snapshot.projects.map((card) => card.updatedAt)).toStrictEqual([
			'2026-11-20T10:00:00.000Z',
			'2026-11-20T11:00:00.000Z'
		]);
	});
});
