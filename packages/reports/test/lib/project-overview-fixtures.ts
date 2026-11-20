/** Synthetic tracker transport only. No test reads the real tracker or its item bodies. */
import { syntheticItems } from './project-overview-item-fixtures';
import { syntheticMachines, syntheticRuns } from './project-overview-run-fixtures';

export { SECRET_NOTE_TOKEN } from './project-overview-item-fixtures';

/** Reference time: 2026-11-20 20:41 in Lisbon (UTC+0 in November). */
export const NOW = Date.parse('2026-11-20T20:41:00.000Z');

export const TRACKER_ITEMS_URL = 'http://127.0.0.1:7701/items?status=all&limit=-1';
export const TRACKER_RUNS_URL = 'http://127.0.0.1:7701/runs?limit=500';
export const TRACKER_MACHINES_URL = 'http://127.0.0.1:7701/machines';

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
