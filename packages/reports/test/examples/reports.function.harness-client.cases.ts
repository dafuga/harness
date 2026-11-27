import { test } from 'vitest';
import { harnessClient } from '../../src/utils/explorer-ui/harnessClient';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The evidence of one state: its cases, under the function they exercise. */
export const where = (state: string) => ({
	unitId: 'reports.function.harness-client',
	symbol: 'harnessClient',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

/** A fetch that answers each request by its URL, and records the URLs it was asked for. */
export function answering(answer: (url: string) => Response | Promise<Response>) {
	const requested: string[] = [];
	const fetcher = (async (input: RequestInfo | URL) => {
		requested.push(String(input));
		return answer(String(input));
	}) as unknown as typeof fetch;
	return { fetcher, requested };
}

export const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

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
