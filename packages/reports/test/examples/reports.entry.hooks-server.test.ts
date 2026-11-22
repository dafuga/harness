import { afterAll, beforeAll, test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { handle } from '../../src/hooks.server';

// The agent controller serves only /api/agent, which these cases never request; stubbing it keeps
// the desktop services it pulls in out of this in-process load.
vi.mock('../../src/lib/development-tooling/server-hooks/ConsoleAgentController', () => ({
	ConsoleAgentController: class {}
}));

type HandleInput = Parameters<typeof handle>[0];
type Resolve = HandleInput['resolve'];

const unitId = 'reports.entry.hooks-server';
const symbol = 'handle';
const loopbackPeer = '127.0.0.1';
const unownedPeer = '203.0.113.7';
const owner = { HARNESS_OWNER_MODE: 'loopback', HARNESS_BIND: '127.0.0.1' };
const saved: Record<string, string | undefined> = {};

/** A RequestEvent carrying only the fields the owner policy and the hook read. */
function eventFor(pathname: string, peer: string): HandleInput['event'] {
	return {
		url: new URL(`http://127.0.0.1:5589${pathname}`),
		request: new Request(`http://127.0.0.1:5589${pathname}`),
		getClientAddress: () => peer
	} as unknown as HandleInput['event'];
}

/** Resolves with a page that has no cache-control header, so the hook must add its own. */
function pageResolver(headers: Record<string, string> = {}) {
	const resolve = vi.fn(async () => new Response('page', { headers }));
	return { resolve, call: resolve as unknown as Resolve };
}

function summarize(response: Response) {
	return { status: response.status, cacheControl: response.headers.get('cache-control') };
}

beforeAll(() => {
	for (const key of [...Object.keys(owner), 'ADDRESS_HEADER']) saved[key] = process.env[key];
	Object.assign(process.env, owner);
	delete process.env.ADDRESS_HEADER;
});

afterAll(() => {
	for (const [key, value] of Object.entries(saved)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

test('Admits the local owner and gives an unheaded page private, no-store', async () => {
	const path = '/harness/branch/main/pages';
	const { resolve, call } = pageResolver();
	const response = await handle({ event: eventFor(path, loopbackPeer), resolve: call });
	const output = { ...summarize(response), resolved: resolve.mock.calls.length };

	expect(output).toEqual({ status: 200, cacheControl: 'private, no-store', resolved: 1 });
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'admits-the-local-owner-and-gives-an-unheaded-page-private-no-store',
			evidence: 'examples-cases',
			file: 'admits-the-local-owner-and-gives-an-unheaded-page-private-no-store.json'
		},
		[
			{
				name: 'loopback owner reaches the page and gets the owner cache policy',
				input: { pathname: path, peer: loopbackPeer, owner },
				output
			}
		]
	);
});

test('Keeps a cache-control the page already set for the local owner', async () => {
	const path = '/harness/data/index.json';
	const { resolve, call } = pageResolver({ 'cache-control': 'public, max-age=60' });
	const response = await handle({ event: eventFor(path, loopbackPeer), resolve: call });
	const output = { ...summarize(response), resolved: resolve.mock.calls.length };

	expect(output).toEqual({ status: 200, cacheControl: 'public, max-age=60', resolved: 1 });
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'keeps-a-cache-control-the-page-already-set-for-the-local-owner',
			evidence: 'examples-cases',
			file: 'keeps-a-cache-control-the-page-already-set-for-the-local-owner.json'
		},
		[
			{
				name: 'page with its own cache-control keeps that header',
				input: { pathname: path, peer: loopbackPeer, pageCacheControl: 'public, max-age=60' },
				output
			}
		]
	);
});

test('Denies an unowned request with 403 before any page handler runs', async () => {
	const path = '/harness/reports';
	const { resolve, call } = pageResolver();
	const response = await handle({ event: eventFor(path, unownedPeer), resolve: call });
	const output = {
		status: response.status,
		body: await response.text(),
		cacheControl: response.headers.get('cache-control'),
		resolved: resolve.mock.calls.length
	};

	expect(output).toEqual({ status: 403, body: 'Forbidden', cacheControl: 'no-store', resolved: 0 });
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'denies-an-unowned-request-with-403-before-any-page-handler-runs',
			evidence: 'examples-cases',
			file: 'denies-an-unowned-request-with-403-before-any-page-handler-runs.json'
		},
		[
			{
				name: 'non-loopback peer is refused and resolve is never called',
				input: { pathname: path, peer: unownedPeer, owner },
				output
			}
		]
	);
});
