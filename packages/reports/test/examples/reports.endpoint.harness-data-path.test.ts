import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { RequestEvent } from '@sveltejs/kit';
import { test, vi } from 'vitest';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

const unitId = 'reports.endpoint.harness-data-path';
const loopbackOwner = {
	HARNESS_OWNER_MODE: 'loopback',
	HARNESS_BIND: '127.0.0.1',
	ADDRESS_HEADER: ''
};
const forbidden = { status: 403, type: 'text/plain', body: 'Forbidden' };

/** The route module is loaded fresh per request, because the owner policy is read once per load. */
const load = () => import('../../src/routes/harness/data/[...path]/+server');

/** A RequestEvent for `/harness/data/<path>` from one peer; the handler reads only params and the peer. */
function event(path: string | undefined, client: string): RequestEvent {
	const url = new URL(`http://127.0.0.1/harness/data/${path ?? ''}`);
	const params = path === undefined ? {} : { path };
	return { url, request: new Request(url), params, getClientAddress: () => client } as RequestEvent;
}

/** Answers one request under the given environment, returning what the client would receive. */
async function answer(env: Record<string, string>, path: string | undefined, client: string) {
	vi.resetModules();
	for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
	const { GET } = await load();
	const response = await GET(event(path, client));
	return {
		status: response.status,
		type: response.headers.get('content-type'),
		body: await response.text()
	};
}

test('GET for index.json from the owner loopback peer answers 200 with the stored index text', async () => {
	const root = mkdtempSync(join(tmpdir(), 'harness-data-path-'));
	const index = JSON.stringify({ build: 'disposable-fixture', commits: [] });
	try {
		writeFileSync(join(root, 'index.json'), index);
		const answered = await answer(
			{ ...loopbackOwner, HARNESS_CONSOLE_DATA: root },
			'index.json',
			'127.0.0.1'
		);
		recordExampleCases(
			{
				unitId,
				symbol: 'GET',
				state: 'normal-index-query',
				evidence: 'examples-cases',
				file: 'normal-index-query.json'
			},
			[
				{
					name: 'owner loopback peer reads index.json from a disposable history directory',
					input: { path: 'index.json', client: '127.0.0.1' },
					output: answered
				}
			]
		);
		expect(answered).toEqual({
			status: 200,
			type: 'application/json; charset=utf-8',
			body: index
		});
	} finally {
		vi.unstubAllEnvs();
		rmSync(root, { recursive: true, force: true });
	}
});

test('GET with no filename answers 404 Not found as plain text for the owner', async () => {
	const absent = await answer(loopbackOwner, undefined, '127.0.0.1');
	const empty = await answer(loopbackOwner, '', '127.0.0.1');
	vi.unstubAllEnvs();
	recordExampleCases(
		{
			unitId,
			symbol: 'GET',
			state: 'missing-filename-not-found',
			evidence: 'examples-cases',
			file: 'missing-filename-not-found.json'
		},
		[
			{
				name: 'owner loopback peer requests /harness/data with no path param',
				input: { path: undefined, client: '127.0.0.1' },
				output: absent
			},
			{
				name: 'owner loopback peer requests /harness/data/ with an empty path',
				input: { path: '', client: '127.0.0.1' },
				output: empty
			}
		]
	);
	const notFound = { status: 404, type: 'text/plain', body: 'Not found' };
	expect([absent, empty]).toEqual([notFound, notFound]);
});

test('GET from a non-loopback peer or without owner mode answers 403 Forbidden', async () => {
	const remote = await answer(loopbackOwner, 'index.json', '203.0.113.7');
	const unset = await answer(
		{ ...loopbackOwner, HARNESS_OWNER_MODE: '' },
		'index.json',
		'127.0.0.1'
	);
	vi.unstubAllEnvs();
	recordExampleCases(
		{
			unitId,
			symbol: 'GET',
			state: 'owner-refusal-forbidden',
			evidence: 'examples-cases',
			file: 'owner-refusal-forbidden.json'
		},
		[
			{
				name: 'owner mode on, but the connection comes from a non-loopback peer',
				input: { path: 'index.json', client: '203.0.113.7' },
				output: remote
			},
			{
				name: 'owner mode not set to loopback, even from a loopback peer',
				input: { path: 'index.json', client: '127.0.0.1', HARNESS_OWNER_MODE: '' },
				output: unset
			}
		]
	);
	expect([remote, unset]).toEqual([forbidden, forbidden]);
});
