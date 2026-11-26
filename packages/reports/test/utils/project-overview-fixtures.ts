/** Synthetic tracker transport only. No test reads the real tracker or its item bodies. */
import type { TrackerCall, TrackerReply, TrackerRoute } from './project-overview-fixtures.types';
import { syntheticItems } from './project-overview-item-fixtures';
import { syntheticMachines, syntheticRuns } from './project-overview-run-fixtures';

export { SECRET_NOTE_TOKEN } from './project-overview-item-fixtures';

/** Reference time: 2026-11-20 20:41 in Lisbon (UTC+0 in November). */
export const NOW = Date.parse('2026-11-20T20:41:00.000Z');

export const TRACKER_ITEMS_URL = 'http://127.0.0.1:7701/items?status=all&limit=-1';
export const TRACKER_RUNS_URL = 'http://127.0.0.1:7701/runs?limit=500';
export const TRACKER_MACHINES_URL = 'http://127.0.0.1:7701/machines';
export const TRACKER_STATUS_URL = 'http://127.0.0.1:7701/status';

const ROUTE_BY_URL: Record<string, TrackerRoute> = {
	[TRACKER_ITEMS_URL]: 'items',
	[TRACKER_RUNS_URL]: 'runs',
	[TRACKER_MACHINES_URL]: 'machines',
	[TRACKER_STATUS_URL]: 'status'
};

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
		status: jsonReply({ machines: syntheticMachines() }),
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
