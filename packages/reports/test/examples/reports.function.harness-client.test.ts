import { afterEach, test, vi } from 'vitest';
import { harnessClient } from '../../src/utils/explorer-ui/harnessClient';
import { HarnessDataLoadError } from '../../src/utils/explorer-ui/harnessClient.types';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

afterEach(() => {
	vi.unstubAllGlobals();
});

/** The evidence of one state: its cases, under the function they exercise. */
const where = (state: string) => ({
	unitId: 'reports.function.harness-client',
	symbol: 'harnessClient',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** A fetch that answers each request by its URL, and records the URLs it was asked for. */
function answering(answer: (url: string) => Response | Promise<Response>) {
	const requested: string[] = [];
	const fetcher = (async (input: RequestInfo | URL) => {
		requested.push(String(input));
		return answer(String(input));
	}) as unknown as typeof fetch;
	return { fetcher, requested };
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** The name and message of a thrown value, or a marker when it is not an error. */
const described = (caught: unknown) =>
	caught instanceof Error ? { name: caught.name, message: caught.message } : { name: 'none' };

test('Fetches each console resource only when its method is called, under the base', async () => {
	const state = 'fetches-console-resources-on-demand';
	const { fetcher, requested } = answering((url) => json({ path: url }));
	const client = harnessClient('/harness', fetcher);
	const idle = requested.length;
	const commit = 'a'.repeat(40);
	const index = await client.index();
	const revision = await client.revision(commit);
	const side = await client.side('sides/src/app.ts.json');
	const activity = await client.activity();
	recordExampleCases(where(state), [
		{ name: 'no request before a method is called', input: { base: '/harness' }, output: { idle } },
		{ name: 'the index method reads index.json', input: { method: 'index' }, output: index },
		{ name: 'the revision method reads its commit file', input: { commit }, output: revision },
		{
			name: 'the side method reads the path it is given',
			input: { path: 'sides/src/app.ts.json' },
			output: side
		},
		{
			name: 'the activity method reads activity.json',
			input: { method: 'activity' },
			output: activity
		}
	]);
	expect(idle).toBe(0);
	expect(index).toEqual({ path: '/harness/data/index.json' });
	expect(requested).toEqual([
		'/harness/data/index.json',
		`/harness/data/revisions/${commit}.json`,
		'/harness/data/sides/src/app.ts.json',
		'/harness/data/activity.json'
	]);
});

test('Shares a default-fetch client by its exact base and caches each path once', async () => {
	const state = 'shared-client-caches-each-path';
	const requested: string[] = [];
	vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
		requested.push(String(input));
		return json({ answer: requested.length });
	});
	const base = '/harness-shared-client';
	const first = harnessClient(base);
	const second = harnessClient(base);
	const slashed = harnessClient(`${base}/`);
	const [concurrentA, concurrentB] = await Promise.all([first.index(), second.index()]);
	const again = await first.index();
	const otherBase = await slashed.index();
	const sameClient = { sameBase: first === second, trailingSlash: first === slashed };
	recordExampleCases(where(state), [
		{ name: 'two calls with one base share a client', input: { base }, output: sameClient },
		{
			name: 'concurrent and repeated index calls reuse one fetch',
			input: { base },
			output: { concurrentA, again }
		},
		{
			name: 'a trailing-slash base is its own client, unnormalized',
			input: { base: `${base}/` },
			output: otherBase
		}
	]);
	expect(sameClient).toEqual({ sameBase: true, trailingSlash: false });
	expect(concurrentA).toBe(concurrentB);
	expect(again).toBe(concurrentA);
	expect(requested).toEqual([`${base}/data/index.json`, `${base}//data/index.json`]);
});

test('Keeps a client built with an injected fetcher separate from the shared clients', async () => {
	const state = 'injected-fetcher-uses-separate-client';
	const ambient: string[] = [];
	vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
		ambient.push(String(input));
		return json({ from: 'ambient' });
	});
	const base = '/harness-injected';
	const one = answering(() => json({ from: 'one' }));
	const two = answering(() => json({ from: 'two' }));
	const left = harnessClient(base, one.fetcher);
	const right = harnessClient(base, one.fetcher);
	const shared = harnessClient(base);
	const injected = await harnessClient(base, two.fetcher).activity();
	const leftIndex = await left.index();
	const rightIndex = await right.index();
	const relations = {
		injectedIsShared: left === shared,
		injectedClientsSeparate: left !== right,
		sharedRepeats: harnessClient(base) === shared
	};
	recordExampleCases(where(state), [
		{
			name: 'injected clients on one base fetch separately',
			input: { base },
			output: { leftIndex, rightIndex }
		},
		{ name: 'an injected client is not the shared client', input: { base }, output: relations },
		{
			name: 'an injected fetcher answers, not the global fetch',
			input: { base },
			output: { injected, ambient }
		}
	]);
	expect(relations).toEqual({
		injectedIsShared: false,
		injectedClientsSeparate: true,
		sharedRepeats: true
	});
	expect(one.requested).toEqual([`${base}/data/index.json`, `${base}/data/index.json`]);
	expect(two.requested).toEqual([`${base}/data/activity.json`]);
	expect(ambient).toEqual([]);
});

test('Rejects a not-ok response naming its data path and status, then retries it', async () => {
	const state = 'failed-response-retries-request';
	const statuses = [503, 200, 404];
	const { fetcher, requested } = answering(() => json({ index: true }, statuses.shift()));
	const client = harnessClient('/harness-retry', fetcher);
	const failedError = await client.index().catch((caught: unknown) => caught);
	const retried = await client.index();
	const cached = await client.index();
	const sideError = await client.side('sides/gone.json').catch((caught: unknown) => caught);
	recordExampleCases(where(state), [
		{
			name: 'the index answered 503 and rejects',
			input: { path: 'index.json' },
			error: described(failedError)
		},
		{
			name: 'the index retried, then cached once fulfilled',
			input: { path: 'index.json' },
			output: { retried, cached }
		},
		{
			name: 'a side answered 404 and rejects',
			input: { path: 'sides/gone.json' },
			error: described(sideError)
		}
	]);
	expect(failedError).toBeInstanceOf(HarnessDataLoadError);
	expect(described(failedError)).toEqual({
		name: 'HarnessDataLoadError',
		message: 'index.json could not be loaded (503)'
	});
	expect(described(sideError).message).toBe('sides/gone.json could not be loaded (404)');
	expect(cached).toBe(retried);
	expect(requested).toEqual([
		'/harness-retry/data/index.json',
		'/harness-retry/data/index.json',
		'/harness-retry/data/sides/gone.json'
	]);
});

test('Propagates fetcher and response.json rejections unwrapped and retries the failed load', async () => {
	const state = 'fetch-and-json-rejections-evict-request';
	const network = new TypeError('fetch failed');
	const parse = new SyntaxError('Unexpected end of JSON input');
	let reachable = false;
	const fetcher = (async () => {
		if (!reachable) throw network;
		return json({ recovered: true });
	}) as unknown as typeof fetch;
	const client = harnessClient('/harness-network', fetcher);
	const thrown = await client.index().catch((caught: unknown) => caught);
	reachable = true;
	const recovered = await client.index();
	const brokenBody = {
		ok: true,
		status: 200,
		json: () => Promise.reject(parse)
	} as unknown as Response;
	const broken = harnessClient(
		'/harness-network',
		(async () => brokenBody) as unknown as typeof fetch
	);
	const malformed = await broken.activity().catch((caught: unknown) => caught);
	recordExampleCases(where(state), [
		{
			name: 'the fetcher rejects; its error passes unwrapped',
			input: { path: 'index.json' },
			error: described(thrown)
		},
		{
			name: 'response.json rejects; its error passes unwrapped',
			input: { path: 'activity.json' },
			error: described(malformed)
		},
		{
			name: 'the failed index is retried once the fetcher answers',
			input: { path: 'index.json' },
			output: recovered
		}
	]);
	expect(thrown).toBe(network);
	expect(malformed).toBe(parse);
	expect(recovered).toEqual({ recovered: true });
});
