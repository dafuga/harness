import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { consoleAccess } from '../../packages/reports/src/utils/explorer-ui/console-server/consoleAccess';
import { consoleBundle } from '../../src/utils/development-tooling/consoleBundle';
import type {
	ConsolePolicy,
	ConsoleRequest
} from '../../src/utils/explorer-ui/consolePolicy.types';

const commit = 'a'.repeat(40);
const image = `${'b'.repeat(64)}.png`;
const unitId = 'function.console-access';
const symbol = 'consoleAccess';

const data = consoleBundle({
	json: {
		'/data/index.json.ts': () => Promise.resolve({ default: '{"schemaVersion":1}' }),
		[`/data/revisions/${commit}.json.ts`]: () => Promise.resolve({ default: '{"commit":"x"}' })
	},
	media: {
		[`/data/media/${image}.ts`]: () =>
			Promise.resolve({ default: btoa('PNGDATA'), type: 'image/png' })
	}
});

function event(path: string): ConsoleRequest {
	return { request: new Request(`http://host${path}`), url: new URL(`http://host${path}`) };
}

async function outcome(response: Response) {
	return { status: response.status, body: await response.text() };
}

test('Serves authorized revision data', async () => {
	const opened: string[] = [];
	const open = consoleAccess({
		policy: () => true,
		data: (request) => {
			opened.push(request.url.pathname);
			return data;
		}
	});
	const response = await open.json(event('/x'), `revisions/${commit}.json`);
	const served = {
		status: response.status,
		type: response.headers.get('content-type'),
		cache: response.headers.get('cache-control'),
		body: await response.text(),
		opened
	};

	expect(served).toEqual({
		status: 200,
		type: 'application/json; charset=utf-8',
		cache: 'no-store',
		body: '{"commit":"x"}',
		opened: ['/x']
	});
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'serves-authorized-revision-data',
			evidence: 'examples-cases',
			file: 'serves-authorized-revision-data.json'
		},
		[
			{
				name: 'answers an admitted revision request',
				input: { policy: 'admitted', path: `revisions/${commit}.json` },
				output: served
			}
		]
	);
});

test('Denies access before reading', async () => {
	const denials: Array<{ name: string; policy: ConsolePolicy }> = [
		{ name: 'false', policy: () => false },
		{ name: 'rejected', policy: () => Promise.reject(new Error('no session')) },
		{ name: 'not exactly true', policy: (() => 'yes') as unknown as ConsolePolicy }
	];
	const cases = [];
	for (const { name, policy } of denials) {
		const opened: string[] = [];
		const closed = consoleAccess({
			policy,
			data: (request) => {
				opened.push(request.url.pathname);
				return data;
			}
		});
		const guarded = await closed.guard(event('/harness'));
		const entered = await closed.entry(event('/harness'), '/harness');
		const json = await closed.json(event('/x'), 'index.json');
		const media = await closed.media(event('/x'), image);
		const output = {
			statuses: [guarded?.status, entered?.status, json.status, media.status],
			body: await json.text(),
			opened
		};
		cases.push({ name: `denies when the policy is ${name}`, input: { policy: name }, output });
	}

	expect(cases.map(({ output }) => output)).toEqual([
		{ statuses: [403, 403, 403, 403], body: 'Forbidden', opened: [] },
		{ statuses: [403, 403, 403, 403], body: 'Forbidden', opened: [] },
		{ statuses: [403, 403, 403, 403], body: 'Forbidden', opened: [] }
	]);
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'denies-access-before-reading',
			evidence: 'examples-cases',
			file: 'denies-access-before-reading.json'
		},
		cases
	);
});

test('Distinguishes missing authorized artifacts', async () => {
	const admit = consoleAccess({ policy: () => true, data });
	const closed = consoleAccess({ policy: () => false, data });
	const missingRevision = `revisions/${'c'.repeat(40)}.json`;
	const missingMedia = `${'c'.repeat(64)}.png`;
	const cases = [
		{
			name: 'admitted present revision',
			input: { policy: 'admitted', kind: 'json', path: `revisions/${commit}.json` },
			output: await outcome(await admit.json(event('/x'), `revisions/${commit}.json`))
		},
		{
			name: 'admitted missing revision',
			input: { policy: 'admitted', kind: 'json', path: missingRevision },
			output: await outcome(await admit.json(event('/x'), missingRevision))
		},
		{
			name: 'admitted present media',
			input: { policy: 'admitted', kind: 'media', name: image },
			output: await outcome(await admit.media(event('/x'), image))
		},
		{
			name: 'admitted missing media',
			input: { policy: 'admitted', kind: 'media', name: missingMedia },
			output: await outcome(await admit.media(event('/x'), missingMedia))
		},
		{
			name: 'closed missing revision',
			input: { policy: 'closed', kind: 'json', path: missingRevision },
			output: await outcome(await closed.json(event('/x'), missingRevision))
		}
	];

	expect(cases.map(({ output }) => output)).toEqual([
		{ status: 200, body: '{"commit":"x"}' },
		{ status: 404, body: 'Not found' },
		{ status: 200, body: 'PNGDATA' },
		{ status: 404, body: 'Not found' },
		{ status: 403, body: 'Forbidden' }
	]);
	recordExampleCases(
		{
			unitId,
			symbol,
			state: 'distinguishes-missing-authorized-artifacts',
			evidence: 'examples-cases',
			file: 'distinguishes-missing-authorized-artifacts.json'
		},
		cases
	);
});
