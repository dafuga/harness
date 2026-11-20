import { describe, expect, it } from 'vitest';
import { readProjectOverview } from '../../src/lib/projects-sessions/project-overview/readProjectOverview';
import {
	NOW,
	SECRET_NOTE_TOKEN,
	TRACKER_ITEMS_URL,
	TRACKER_MACHINES_URL,
	TRACKER_RUNS_URL,
	jsonReply,
	syntheticItems,
	syntheticMachines,
	syntheticRuns,
	syntheticTrackerFetch
} from './project-overview-fixtures';

const FIXED_CALLS = [
	{
		url: TRACKER_ITEMS_URL,
		method: 'GET',
		redirect: 'error',
		cache: 'no-store',
		credentials: 'omit',
		headers: { accept: 'application/json' }
	},
	{
		url: TRACKER_MACHINES_URL,
		method: 'GET',
		redirect: 'error',
		cache: 'no-store',
		credentials: 'omit',
		headers: { accept: 'application/json' }
	},
	{
		url: TRACKER_RUNS_URL,
		method: 'GET',
		redirect: 'error',
		cache: 'no-store',
		credentials: 'omit',
		headers: { accept: 'application/json' }
	}
];

/** The exact snapshot for the synthetic tracker at NOW. Each line is one rule from the spec. */
const EXPECTED_SNAPSHOT = {
	status: 'ready',
	liveSessions: 2,
	machines: [
		{ name: 'box', status: 'ok' },
		{ name: 'mb2', status: 'offline' },
		{ name: 'primary', status: 'busy' },
		{ name: 'runner', status: 'overloaded' }
	],
	projects: [
		// needs-you: flagged, unresolved question; the note's token is redacted.
		{
			agent: 'alpha-app',
			state: 'needs-you',
			liveSessions: 0,
			counts: { open: 1, in_progress: 1, blocked: 0, done: 0 },
			items: [
				{
					id: 'a2',
					title: 'Migrate invoices',
					status: 'in_progress',
					updatedAt: '2026-11-19T14:41:00.000Z',
					due: null,
					live: false,
					stale: true
				}
			],
			attention: {
				item: {
					id: 'a1',
					title: 'Choose billing provider',
					status: 'open',
					updatedAt: '2026-11-20T18:41:00.000Z',
					due: null,
					live: false,
					stale: false
				},
				text: 'Pick Stripe or Paddle?'
			},
			blocked: null,
			milestone: { text: 'Checked CI with [redacted]', at: '2026-11-20T19:41:00.000Z' },
			updatedAt: '2026-11-20T18:41:00.000Z'
		},
		// blocked: no live session; the newest blocked reason is shown.
		{
			agent: 'beta-site',
			state: 'blocked',
			liveSessions: 0,
			counts: { open: 0, in_progress: 0, blocked: 2, done: 0 },
			items: [],
			attention: null,
			blocked: {
				item: {
					id: 'b1',
					title: 'Connect domain',
					status: 'blocked',
					updatedAt: '2026-11-20T15:41:00.000Z',
					due: null,
					live: false,
					stale: false
				},
				text: 'Waiting on DNS from registrar'
			},
			milestone: null,
			updatedAt: '2026-11-20T15:41:00.000Z'
		},
		// active: a live run on an old in-progress item; the blocked item is a count, not the state.
		// The run from the offline computer and the run whose project field disagrees are not counted.
		{
			agent: 'delta-docs',
			state: 'active',
			liveSessions: 1,
			counts: { open: 0, in_progress: 2, blocked: 0, done: 1 },
			items: [
				{
					id: 'd1',
					title: 'Write onboarding guide',
					status: 'in_progress',
					updatedAt: '2026-11-20T18:41:00.000Z',
					due: null,
					live: true,
					stale: false
				},
				{
					id: 'd3',
					title: 'Pick theme',
					status: 'in_progress',
					updatedAt: '2026-11-20T16:41:00.000Z',
					due: '2026-11-23T10:00:00.000Z',
					live: false,
					stale: false
				}
			],
			attention: null,
			blocked: null,
			milestone: { text: 'Shipped onboarding', at: '2026-11-20T00:41:00.000Z' },
			updatedAt: '2026-11-20T18:41:00.000Z'
		},
		// active at exactly 24 hours: the window is inclusive.
		{
			agent: 'eta-edge-active',
			state: 'active',
			liveSessions: 0,
			counts: { open: 0, in_progress: 1, blocked: 0, done: 0 },
			items: [
				{
					id: 'x1',
					title: 'Boundary active',
					status: 'in_progress',
					updatedAt: '2026-11-19T20:41:00.000Z',
					due: null,
					live: false,
					stale: false
				}
			],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: '2026-11-19T20:41:00.000Z'
		},
		// blocked with a live session is active, not blocked; its live run is the only one counted.
		{
			agent: 'gamma-api',
			state: 'active',
			liveSessions: 1,
			counts: { open: 0, in_progress: 1, blocked: 1, done: 0 },
			items: [
				{
					id: 'g1',
					title: 'Rate limit middleware',
					status: 'in_progress',
					updatedAt: '2026-11-19T04:41:00.000Z',
					due: '2026-11-21T12:00:00.000Z',
					live: true,
					stale: false
				}
			],
			attention: null,
			blocked: {
				item: {
					id: 'g2',
					title: 'Vendor access',
					status: 'blocked',
					updatedAt: '2026-11-20T17:41:00.000Z',
					due: null,
					live: false,
					stale: false
				},
				text: 'Needs API key from vendor'
			},
			milestone: { text: 'Wrote tests', at: '2026-11-20T20:11:00.000Z' },
			updatedAt: '2026-11-20T17:41:00.000Z'
		},
		// quiet: open and stale in-progress items, no live session, no change for 24 hours.
		{
			agent: 'epsilon-ops',
			state: 'quiet',
			liveSessions: 0,
			counts: { open: 1, in_progress: 1, blocked: 0, done: 0 },
			items: [
				{
					id: 'e1',
					title: 'Rotate logs',
					status: 'in_progress',
					updatedAt: '2026-11-19T14:41:00.000Z',
					due: '2026-11-18T09:00:00.000Z',
					live: false,
					stale: true
				}
			],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: '2026-11-20T10:41:00.000Z'
		},
		// quiet one second past 24 hours.
		{
			agent: 'theta-edge-quiet',
			state: 'quiet',
			liveSessions: 0,
			counts: { open: 0, in_progress: 1, blocked: 0, done: 0 },
			items: [
				{
					id: 'y1',
					title: 'Boundary quiet',
					status: 'in_progress',
					updatedAt: '2026-11-19T20:40:59.000Z',
					due: null,
					live: false,
					stale: true
				}
			],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: '2026-11-19T20:40:59.000Z'
		},
		// quiet: ignored records do not count and do not move the card's update time.
		{
			agent: 'xi-ignored',
			state: 'quiet',
			liveSessions: 0,
			counts: { open: 1, in_progress: 0, blocked: 0, done: 0 },
			items: [],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: '2026-11-20T15:41:00.000Z'
		},
		// quiet: newly open-only work stays quiet until it starts.
		{
			agent: 'zeta-new',
			state: 'quiet',
			liveSessions: 0,
			counts: { open: 1, in_progress: 0, blocked: 0, done: 0 },
			items: [],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: '2026-11-20T19:41:00.000Z'
		},
		// done: all items done and the latest completion is within seven days.
		{
			agent: 'kappa-done',
			state: 'done',
			liveSessions: 0,
			counts: { open: 0, in_progress: 0, blocked: 0, done: 1 },
			items: [],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: '2026-11-17T20:41:00.000Z'
		},
		// done at exactly seven days: still visible.
		{
			agent: 'lambda-done-edge',
			state: 'done',
			liveSessions: 0,
			counts: { open: 0, in_progress: 0, blocked: 0, done: 1 },
			items: [],
			attention: null,
			blocked: null,
			milestone: null,
			updatedAt: '2026-11-13T20:41:00.000Z'
		}
	]
};

/** Each unavailable case replaces one read or adds a transport failure. */
const UNAVAILABLE_CASES: [string, Parameters<typeof syntheticTrackerFetch>[0]][] = [
	['network refusal', { items: () => Promise.reject(new TypeError('fetch failed')) }],
	['items HTTP 500', { items: () => new Response('down', { status: 500 }) }],
	[
		'redirect is not followed',
		{
			runs: () =>
				new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:9/elsewhere' } })
		}
	],
	['malformed JSON', { machines: () => new Response('{"not": ', { status: 200 }) }],
	[
		'unknown item status',
		{
			items: jsonReply(
				syntheticItems().map((row, i) => (i === 0 ? { ...row, status: 'paused' } : row))
			)
		}
	],
	['unknown machine status', { machines: jsonReply([{ node: 'box', status: 'sleeping' }]) }],
	['runs not a list', { runs: jsonReply({ runs: syntheticRuns() }) }],
	['upstream never answers', { items: () => new Promise<Response>(() => {}) }]
];

describe('readProjectOverview', () => {
	it('reads only the three fixed GET tracker operations, without redirects or credentials', async () => {
		const { fetcher, calls } = syntheticTrackerFetch();

		await readProjectOverview(fetcher, NOW);

		expect([...calls].sort((a, b) => a.url.localeCompare(b.url))).toStrictEqual(
			[...FIXED_CALLS].sort((a, b) => a.url.localeCompare(b.url))
		);
	});

	it('projects the synthetic tracker into the exact overview states', async () => {
		const { fetcher } = syntheticTrackerFetch();

		const snapshot = await readProjectOverview(fetcher, NOW);

		expect(JSON.parse(JSON.stringify(snapshot))).toStrictEqual(EXPECTED_SNAPSHOT);
	});

	it('gives the same snapshot when upstream order changes', async () => {
		const { fetcher } = syntheticTrackerFetch({
			items: jsonReply(syntheticItems().reverse()),
			runs: jsonReply(syntheticRuns().reverse()),
			machines: jsonReply(syntheticMachines().reverse())
		});

		const snapshot = await readProjectOverview(fetcher, NOW);

		expect(JSON.parse(JSON.stringify(snapshot))).toStrictEqual(EXPECTED_SNAPSHOT);
	});

	it('returns an empty ready snapshot when the tracker has no records', async () => {
		const { fetcher } = syntheticTrackerFetch({
			items: jsonReply([]),
			runs: jsonReply([]),
			machines: jsonReply([])
		});

		expect(await readProjectOverview(fetcher, NOW)).toStrictEqual({
			status: 'ready',
			projects: [],
			machines: [],
			liveSessions: 0
		});
	});

	it.each(UNAVAILABLE_CASES)(
		'is unavailable when %s',
		async (_name, overrides) => {
			const { fetcher } = syntheticTrackerFetch(overrides);

			expect(await readProjectOverview(fetcher, NOW)).toStrictEqual({ status: 'unavailable' });
		},
		5000
	);

	it('keeps secrets, deleted, sensitive and unmapped records out of the snapshot', async () => {
		const { fetcher } = syntheticTrackerFetch();

		const snapshot = await readProjectOverview(fetcher, NOW);
		const text = JSON.stringify(snapshot);

		expect(snapshot.status).toBe('ready');
		const hidden = [SECRET_NOTE_TOKEN, 'example.invalid', 'wrong-project', 'secret thing'];
		for (const leak of [...hidden, 'Private draft', 'Deleted plan', 'No project']) {
			expect(text).not.toContain(leak);
		}
	});
});
