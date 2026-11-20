/** Synthetic tracker records only. No test reads the real tracker or its item bodies. */

/** Reference time: 2026-11-20 20:41 in Lisbon (UTC+0 in November). */
export const NOW = Date.parse('2026-11-20T20:41:00.000Z');

export const TRACKER_ITEMS_URL = 'http://127.0.0.1:7701/items?status=all&limit=-1';
export const TRACKER_RUNS_URL = 'http://127.0.0.1:7701/runs?limit=500';
export const TRACKER_MACHINES_URL = 'http://127.0.0.1:7701/machines';

/** A credential-shaped value placed in a note; it must never reach the snapshot. */
export const SECRET_NOTE_TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';

export type TrackerRoute = 'items' | 'runs' | 'machines';
export type TrackerReply = () => Response | Promise<Response>;
export type TrackerCall = {
	url: string;
	method: string | undefined;
	redirect: string | undefined;
	cache: string | undefined;
	credentials: string | undefined;
	headers: Record<string, string> | undefined;
};

const ROUTE_BY_URL: Record<string, TrackerRoute> = {
	[TRACKER_ITEMS_URL]: 'items',
	[TRACKER_RUNS_URL]: 'runs',
	[TRACKER_MACHINES_URL]: 'machines'
};

type Flags = { due?: string; notes?: Record<string, unknown>[]; extra?: Record<string, unknown> };

/** A tracker item row: agent, status, change time and the fields the overview reads. */
function row(
	fields: { agent: string | null; id: string; status: string; title: string; updated: string },
	flags: Flags = {}
): Record<string, unknown> {
	return {
		id: fields.id,
		title: fields.title,
		status: fields.status,
		updated_at: fields.updated,
		due: flags.due ?? null,
		agent: fields.agent,
		...(flags.notes ? { notes_log: flags.notes } : {}),
		...flags.extra
	};
}

/** A callback target and a note carrying a credential-shaped token; neither may reach a snapshot. */
const CALLBACK = { target: 'https://example.invalid/hook?token=abc', node: 'box' };
const SECRET_NOTE = [
	{ at: '2026-11-20T19:41:00.000Z', node: 'box', text: `Checked CI with ${SECRET_NOTE_TOKEN}` }
];

/** Open, in-progress and blocked rows for the first projects. */
function alphaBetaRows(): Record<string, unknown>[] {
	return [
		row(
			{
				agent: 'alpha-app',
				id: 'a1',
				status: 'open',
				title: 'Choose billing provider',
				updated: '2026-11-20T18:41:00.000Z'
			},
			{
				notes: SECRET_NOTE,
				extra: {
					callback: CALLBACK,
					needs_daniel: true,
					resolved: false,
					question: 'Pick Stripe or Paddle?'
				}
			}
		),
		row({
			agent: 'alpha-app',
			id: 'a2',
			status: 'in_progress',
			title: 'Migrate invoices',
			updated: '2026-11-19T14:41:00.000Z'
		}),
		row(
			{
				agent: 'beta-site',
				id: 'b1',
				status: 'blocked',
				title: 'Connect domain',
				updated: '2026-11-20T15:41:00.000Z'
			},
			{ extra: { blocked_reason: 'Waiting on DNS from registrar' } }
		),
		row(
			{
				agent: 'beta-site',
				id: 'b2',
				status: 'blocked',
				title: 'Buy certificate',
				updated: '2026-11-20T10:41:00.000Z'
			},
			{ extra: { blocked_reason: 'Old reason: budget' } }
		)
	];
}

/** Gamma and delta rows, including a blocked item with a live session elsewhere. */
function gammaDeltaRows(): Record<string, unknown>[] {
	return [
		row(
			{
				agent: 'gamma-api',
				id: 'g1',
				status: 'in_progress',
				title: 'Rate limit middleware',
				updated: '2026-11-19T04:41:00.000Z'
			},
			{
				due: '2026-11-21T12:00:00.000Z',
				notes: [{ at: '2026-11-20T20:11:00.000Z', node: 'box', text: 'Wrote tests' }]
			}
		),
		row(
			{
				agent: 'gamma-api',
				id: 'g2',
				status: 'blocked',
				title: 'Vendor access',
				updated: '2026-11-20T17:41:00.000Z'
			},
			{ extra: { blocked_reason: 'Needs API key from vendor' } }
		),
		row({
			agent: 'delta-docs',
			id: 'd1',
			status: 'in_progress',
			title: 'Write onboarding guide',
			updated: '2026-11-20T18:41:00.000Z'
		})
	];
}

/** Delta and epsilon rows: a due in-progress item, a shipped item and an open item. */
function deltaEpsilonRows(): Record<string, unknown>[] {
	return [
		row(
			{
				agent: 'delta-docs',
				id: 'd3',
				status: 'in_progress',
				title: 'Pick theme',
				updated: '2026-11-20T16:41:00.000Z'
			},
			{ due: '2026-11-23T10:00:00.000Z' }
		),
		row(
			{
				agent: 'delta-docs',
				id: 'd2',
				status: 'done',
				title: 'Shipped onboarding',
				updated: '2026-11-20T00:41:00.000Z'
			},
			{
				notes: [{ at: '2026-11-20T00:41:00.000Z', node: 'primary', text: 'Shipped onboarding' }]
			}
		),
		row(
			{
				agent: 'epsilon-ops',
				id: 'e1',
				status: 'in_progress',
				title: 'Rotate logs',
				updated: '2026-11-19T14:41:00.000Z'
			},
			{ due: '2026-11-18T09:00:00.000Z' }
		),
		row({
			agent: 'epsilon-ops',
			id: 'e2',
			status: 'open',
			title: 'Archive old backups',
			updated: '2026-11-20T10:41:00.000Z'
		})
	];
}

/** Boundary rows: new work, the exact 24-hour and 7-day edges, and the first clear-cut states. */
function boundaryRows(): Record<string, unknown>[] {
	return [
		row({
			agent: 'zeta-new',
			id: 'z1',
			status: 'open',
			title: 'Scope new idea',
			updated: '2026-11-20T19:41:00.000Z'
		}),
		row({
			agent: 'eta-edge-active',
			id: 'x1',
			status: 'in_progress',
			title: 'Boundary active',
			updated: '2026-11-19T20:41:00.000Z'
		}),
		row({
			agent: 'theta-edge-quiet',
			id: 'y1',
			status: 'in_progress',
			title: 'Boundary quiet',
			updated: '2026-11-19T20:40:59.000Z'
		}),
		row({
			agent: 'kappa-done',
			id: 'k1',
			status: 'done',
			title: 'Shipped invoices',
			updated: '2026-11-17T20:41:00.000Z'
		}),
		row({
			agent: 'lambda-done-edge',
			id: 'l1',
			status: 'done',
			title: 'Shipped on the edge',
			updated: '2026-11-13T20:41:00.000Z'
		}),
		row({
			agent: 'mu-old-done',
			id: 'm1',
			status: 'done',
			title: 'Shipped long ago',
			updated: '2026-11-13T20:40:59.000Z'
		})
	];
}

/** Sensitive, deleted and ignored rows, and an unowned row; none of them may reach a card. */
function hiddenRows(): Record<string, unknown>[] {
	return [
		row(
			{
				agent: 'nu-hidden',
				id: 'n1',
				status: 'in_progress',
				title: 'Private draft',
				updated: '2026-11-20T19:41:00.000Z'
			},
			{ extra: { sensitive: true } }
		),
		row(
			{
				agent: 'nu-hidden',
				id: 'n2',
				status: 'blocked',
				title: 'Deleted plan',
				updated: '2026-11-20T19:41:00.000Z'
			},
			{ extra: { deleted: true, blocked_reason: 'secret thing' } }
		),
		row(
			{
				agent: 'xi-ignored',
				id: 'xi1',
				status: 'ignored',
				title: 'Dropped idea',
				updated: '2026-11-20T19:41:00.000Z'
			},
			{ extra: { blocked_reason: null } }
		),
		row({
			agent: 'xi-ignored',
			id: 'xi2',
			status: 'open',
			title: 'Real idea',
			updated: '2026-11-20T15:41:00.000Z'
		}),
		row(
			{
				agent: null,
				id: 'orphan',
				status: 'blocked',
				title: 'No project',
				updated: '2026-11-20T19:00:00.000Z'
			},
			{ extra: { blocked_reason: 'no owner' } }
		)
	];
}

/** Item rows, including a callback, deleted, sensitive, ignored and unowned records. */
export function syntheticItems(): Record<string, unknown>[] {
	return [
		...alphaBetaRows(),
		...gammaDeltaRows(),
		...deltaEpsilonRows(),
		...boundaryRows(),
		...hiddenRows()
	];
}

/** Runs whose project field disagrees with the item's agent, duplicated and offline views included. */
export function syntheticRuns(): Record<string, unknown>[] {
	return [
		{ id: 101, node: 'box', item_id: 'g1', state: 'running', project: 'wrong-project' },
		{ id: 101, node: 'box', item_id: 'g1', state: 'running', project: 'wrong-project' },
		{ id: 102, node: 'mb2', item_id: 'g1', state: 'running', project: 'gamma-api' },
		{ id: 103, node: 'box', item_id: 'g1', state: 'finished', project: 'gamma-api' },
		{ id: 104, node: 'box', item_id: 'n1', state: 'running', project: 'nu-hidden' },
		{ id: 105, node: 'box', item_id: 'missing', state: 'running', project: null },
		{ id: 106, node: 'box', item_id: 'd1', state: 'running', project: 'delta-docs' }
	];
}

/** Computers with status values. Their session and process counts are not project totals. */
export function syntheticMachines(): Record<string, unknown>[] {
	return [
		{ node: 'box', role: 'primary', status: 'ok', reasons: [], agents: { claude: 7, codex: 2 } },
		{ node: 'mb2', role: 'runner', status: 'offline', reasons: ['no sample for 40 min'] },
		{ node: 'primary', role: 'primary', status: 'busy', reasons: ['CPU busy'] },
		{ node: 'runner', role: 'runner', status: 'overloaded', reasons: ['RAM low'] }
	];
}

export function jsonReply(body: unknown): TrackerReply {
	return () =>
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		});
}

/** A fake tracker transport that records every call. Unknown URLs fail the read. */
export function syntheticTrackerFetch(overrides: Partial<Record<TrackerRoute, TrackerReply>> = {}) {
	const calls: TrackerCall[] = [];
	const replies: Record<TrackerRoute, TrackerReply> = {
		items: jsonReply(syntheticItems()),
		runs: jsonReply(syntheticRuns()),
		machines: jsonReply(syntheticMachines()),
		...overrides
	};
	const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		calls.push({
			url,
			method: init?.method,
			redirect: init?.redirect,
			cache: init?.cache,
			credentials: init?.credentials,
			headers: init?.headers as Record<string, string> | undefined
		});
		const route = ROUTE_BY_URL[url];
		if (!route) throw new TypeError(`unexpected tracker read ${url}`);
		return replies[route]();
	}) as typeof fetch;
	return { fetcher, calls };
}

/** Each unavailable case replaces one read or adds a transport failure. */
export const UNAVAILABLE_CASES: [string, Partial<Record<TrackerRoute, TrackerReply>>][] = [
	['network refusal', { items: () => Promise.reject(new TypeError('fetch failed')) }],
	['items HTTP 500', { items: () => new Response('down', { status: 500 }) }],
	[
		'redirect is not followed',
		{
			runs: () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:9/x' } })
		}
	],
	['malformed JSON', { machines: () => new Response('{"not": ', { status: 200 }) }],
	[
		'unknown item status',
		{
			items: jsonReply(
				syntheticItems().map((item, i) => (i === 0 ? { ...item, status: 'paused' } : item))
			)
		}
	],
	['unknown machine status', { machines: jsonReply([{ node: 'box', status: 'sleeping' }]) }],
	['runs not a list', { runs: jsonReply({ runs: syntheticRuns() }) }],
	['upstream never answers', { items: () => new Promise<Response>(() => {}) }]
];
