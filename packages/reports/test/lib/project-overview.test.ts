import { describe, expect, it } from 'vitest';
import { readProjectOverview } from '../../src/lib/projects-sessions/project-overview/readProjectOverview';
import { EXPECTED_SNAPSHOT } from './project-overview-expected';
import {
	NOW,
	SECRET_NOTE_TOKEN,
	TRACKER_ITEMS_URL,
	TRACKER_MACHINES_URL,
	TRACKER_RUNS_URL,
	TRACKER_STATUS_URL,
	jsonReply,
	syntheticTrackerFetch
} from './project-overview-fixtures';
import { syntheticItems } from './project-overview-item-fixtures';
import { syntheticMachines, syntheticRuns } from './project-overview-run-fixtures';

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
	it('reads only fixed GET tracker operations, without redirects or credentials', async () => {
		const { fetcher, calls } = syntheticTrackerFetch();

		await readProjectOverview(fetcher, NOW);

		expect([...calls].sort((a, b) => a.url.localeCompare(b.url))).toStrictEqual(
			[...FIXED_CALLS].sort((a, b) => a.url.localeCompare(b.url))
		);

		const native = syntheticTrackerFetch({ machines: () => new Response(null, { status: 404 }) });
		const snapshot = await readProjectOverview(native.fetcher, NOW);

		expect(JSON.parse(JSON.stringify(snapshot))).toStrictEqual(EXPECTED_SNAPSHOT);
		expect(native.calls.toSorted((a, b) => a.url.localeCompare(b.url))).toStrictEqual(
			[...FIXED_CALLS, { ...FIXED_CALLS[0], url: TRACKER_STATUS_URL }].toSorted((a, b) =>
				a.url.localeCompare(b.url)
			)
		);

		const malformed = syntheticTrackerFetch({
			machines: () => new Response(null, { status: 404 }),
			status: jsonReply({ machines: [{ node: 'box', status: 'sleeping' }] })
		});
		expect(await readProjectOverview(malformed.fetcher, NOW)).toStrictEqual({
			status: 'unavailable'
		});

		const failed = syntheticTrackerFetch({ machines: () => new Response(null, { status: 500 }) });
		expect(await readProjectOverview(failed.fetcher, NOW)).toStrictEqual({ status: 'unavailable' });
		expect(failed.calls.map(({ url }) => url)).not.toContain(TRACKER_STATUS_URL);
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
