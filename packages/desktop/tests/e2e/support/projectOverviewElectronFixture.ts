import type { ElectronApplication } from '../../../../../test/support/browserTest';
import type {
	TrackerDouble,
	TrackerReadKey,
	TrackerRequestRecord
} from './projectOverviewNativeFixture.types';

/**
 * The production fixed loopback reads (packages/reports/.../projectOverviewTracker.ts). The double
 * answers exactly these GET paths; the spec never configures another endpoint.
 */
export const TRACKER_ORIGIN = 'http://127.0.0.1:7701';
export const TRACKER_URLS: Record<TrackerReadKey, string> = {
	items: `${TRACKER_ORIGIN}/items?status=all&limit=-1`,
	runs: `${TRACKER_ORIGIN}/runs?limit=500`,
	machines: `${TRACKER_ORIGIN}/machines`
};

/** The sentinels a leak check looks for: none may reach the DOM, the snapshot or the bridge. */
export const LEAK_SENTINELS = [
	'fixture-sentinel-token-0001',
	'http://127.0.0.1:9/fixture-sentinel-callback',
	'fixture-bearer-sentinel'
] as const;

const minutesAgo = (now: number, minutes: number) => new Date(now - minutes * 60_000).toISOString();

/** Items for the projects that need attention or are active: one per state, with a sensitive record. */
function attentionItems(now: number): unknown[] {
	return [
		{
			id: 'fx-needs-1',
			title: 'Synthetic question item',
			status: 'open',
			updated_at: minutesAgo(now, 60),
			agent: 'fixture-needs',
			needs_daniel: true,
			resolved: false,
			question: 'Synthetic question for the owner?'
		},
		{
			id: 'fx-needs-2',
			title: 'Synthetic sensitive title',
			status: 'open',
			updated_at: minutesAgo(now, 10),
			agent: 'fixture-needs',
			sensitive: true,
			needs_daniel: true,
			question: 'Sensitive question must not show'
		},
		{
			id: 'fx-blocked-1',
			title: 'Synthetic blocked item',
			status: 'blocked',
			updated_at: minutesAgo(now, 120),
			agent: 'fixture-blocked',
			blocked_reason: 'Synthetic blocked reason Bearer fixture-bearer-sentinel'
		},
		{
			id: 'fx-active-1',
			title: 'Synthetic live item',
			status: 'in_progress',
			updated_at: minutesAgo(now, 5),
			agent: 'fixture-active',
			notes_log: [{ at: minutesAgo(now, 5), text: 'Synthetic milestone' }]
		}
	];
}

/** Items for the quiet and done projects; the quiet record carries raw sentinel fields it must not show. */
function quietAndDoneItems(now: number): unknown[] {
	return [
		{
			id: 'fx-quiet-1',
			title: 'Synthetic stale item',
			status: 'in_progress',
			updated_at: minutesAgo(now, 3 * 24 * 60),
			agent: 'fixture-quiet',
			token: LEAK_SENTINELS[0],
			callback_url: LEAK_SENTINELS[1]
		},
		{
			id: 'fx-done-1',
			title: 'Synthetic finished item',
			status: 'done',
			updated_at: minutesAgo(now, 2 * 24 * 60),
			agent: 'fixture-done'
		},
		{
			id: 'fx-done-2',
			title: 'Synthetic finished item two',
			status: 'done',
			updated_at: minutesAgo(now, 3 * 24 * 60),
			agent: 'fixture-done'
		}
	];
}

/** Records that must never reach a card: deleted, ignored, and unnamed. */
function excludedItems(now: number): unknown[] {
	return [
		{
			id: 'fx-deleted-1',
			title: 'Synthetic deleted item',
			status: 'open',
			updated_at: minutesAgo(now, 1),
			agent: 'fixture-deleted',
			deleted: true
		},
		{
			id: 'fx-ignored-1',
			title: 'Synthetic ignored item',
			status: 'ignored',
			updated_at: minutesAgo(now, 1),
			agent: 'fixture-ignored'
		},
		{
			id: 'fx-unnamed-1',
			title: 'Synthetic unnamed item',
			status: 'open',
			updated_at: minutesAgo(now, 1)
		}
	];
}

/**
 * Synthetic raw GET payloads for five projects, one per state, plus records that must be excluded.
 * The sentinel fields are raw tracker data the overview never reads.
 */
export function syntheticTrackerPayloads(now: number): TrackerDouble['payloads'] {
	const runs = [
		{ id: 101, node: 'fixture-computer', item_id: 'fx-active-1', state: 'running' },
		{ id: 102, node: 'fixture-computer', item_id: 'fx-done-1', state: 'done' }
	];
	const machines = [{ node: 'fixture-computer', status: 'busy' }];
	const items = [...attentionItems(now), ...quietAndDoneItems(now), ...excludedItems(now)];
	return { items, runs, machines };
}

/**
 * Installs the tracker double in the MAIN process of the built app. It answers only the three fixed
 * GET paths, refuses any other request to the tracker origin, and passes other traffic through.
 * Each request is recorded on globalThis.overviewTrackerRequests for the spec to read.
 */
export async function installTrackerDouble(app: ElectronApplication, double: TrackerDouble) {
	await app.evaluate((_electron, input: TrackerDouble) => {
		const real = globalThis.fetch;
		const requests: TrackerRequestRecord[] = [];
		const answers = new Map<string, unknown[]>(
			(Object.keys(input.urls) as TrackerReadKey[]).map((key) => [
				input.urls[key],
				input.payloads[key]
			])
		);
		answers.set(`${input.urls.runs}&include_active=1`, input.payloads.runs);
		Object.assign(globalThis, { overviewTrackerRequests: requests });
		globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
			const href = String(url);
			const method = (init?.method ?? 'GET').toUpperCase();
			if (!href.startsWith(input.origin)) return real(url, init);
			if (method !== 'GET' || !answers.has(href)) {
				requests.push({ method, url: href, outcome: 'refused' });
				throw new TypeError('refused: not a fixed project-overview read');
			}
			if (input.mode === 'down') {
				requests.push({ method, url: href, outcome: 'unreachable' });
				throw new TypeError('tracker unreachable');
			}
			requests.push({ method, url: href, outcome: 'answered' });
			return new Response(JSON.stringify(answers.get(href)), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			});
		}) as typeof fetch;
	}, double);
}

/** The requests the double has recorded so far, in arrival order. */
export async function trackerRequests(app: ElectronApplication): Promise<TrackerRequestRecord[]> {
	return app.evaluate(
		() =>
			(globalThis as unknown as { overviewTrackerRequests: TrackerRequestRecord[] })
				.overviewTrackerRequests
	);
}
