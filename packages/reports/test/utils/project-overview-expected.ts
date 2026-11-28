/** The exact snapshot for the synthetic tracker at NOW. Each card is one rule from the spec. */

/** A card row as the overview shows it. Due is null and the flags are false unless a row sets them. */
const row = (id: string, title: string, status: string, updatedAt: string) => ({
	id,
	title,
	status,
	updatedAt,
	due: null as string | null,
	live: false,
	stale: false
});

/** A callout pairs one row with its sanitized text. */
const callout = (item: ReturnType<typeof row>, text: string) => ({ item, text });

export const EXPECTED_SNAPSHOT = {
	status: 'ready',
	liveSessions: 2,
	machines: [
		{ name: 'box', status: 'ok' },
		{ name: 'primary', status: 'busy' },
		{ name: 'runner', status: 'overloaded' },
		{ name: 'mb2', status: 'offline' }
	],
	projects: [
		// needs-you: flagged, unresolved question; the note's token is redacted.
		{
			agent: 'alpha-app',
			state: 'needs-you',
			liveSessions: 0,
			counts: { open: 1, in_progress: 1, blocked: 0, done: 0 },
			items: [
				{ ...row('a2', 'Migrate invoices', 'in_progress', '2026-11-19T14:41:00.000Z'), stale: true }
			],
			attention: callout(
				row('a1', 'Choose billing provider', 'open', '2026-11-20T18:41:00.000Z'),
				'Pick Stripe or Paddle?'
			),
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
			blocked: callout(
				row('b1', 'Connect domain', 'blocked', '2026-11-20T15:41:00.000Z'),
				'Waiting on DNS from registrar'
			),
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
					...row('d1', 'Write onboarding guide', 'in_progress', '2026-11-20T18:41:00.000Z'),
					live: true
				},
				{
					...row('d3', 'Pick theme', 'in_progress', '2026-11-20T16:41:00.000Z'),
					due: '2026-11-23T10:00:00.000Z'
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
			items: [row('x1', 'Boundary active', 'in_progress', '2026-11-19T20:41:00.000Z')],
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
					...row('g1', 'Rate limit middleware', 'in_progress', '2026-11-19T04:41:00.000Z'),
					due: '2026-11-21T12:00:00.000Z',
					live: true
				}
			],
			attention: null,
			blocked: callout(
				row('g2', 'Vendor access', 'blocked', '2026-11-20T17:41:00.000Z'),
				'Needs API key from vendor'
			),
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
					...row('e1', 'Rotate logs', 'in_progress', '2026-11-19T14:41:00.000Z'),
					due: '2026-11-18T09:00:00.000Z',
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
				{ ...row('y1', 'Boundary quiet', 'in_progress', '2026-11-19T20:40:59.000Z'), stale: true }
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
