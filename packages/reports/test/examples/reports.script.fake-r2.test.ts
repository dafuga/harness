import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

type Handler = (request: Request) => Promise<Response>;
type RecordMeta = {
	unitId: string;
	symbol: string;
	state: string;
	evidence: string;
	file: string;
};
type Summary = {
	status: number;
	etag: string | null;
	contentType: string | null;
	body: string;
};

const BASE = 'http://127.0.0.1:5590';

function meta(state: string): RecordMeta {
	return {
		unitId: 'reports.script.fake-r2',
		symbol: 'fetch',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

// The script starts Bun.serve at load time. The global is stubbed so no port opens;
// the captured fetch handler is the unit's real code and is called directly.
async function loadScript(serve: (options: { fetch: Handler }) => unknown): Promise<void> {
	vi.stubGlobal('Bun', { serve });
	vi.resetModules();
	try {
		// @ts-expect-error the script has no exports; it is loaded for its top-level side effect
		await import('../../scripts/fake-r2');
	} finally {
		vi.unstubAllGlobals();
	}
}

async function loadFetchHandler(): Promise<Handler> {
	const served: { fetch?: Handler } = {};
	await loadScript((options) => {
		served.fetch = options.fetch;
		return undefined;
	});
	const handler = served.fetch;
	if (!handler) throw new Error('fetch handler was not registered');
	return handler;
}

function request(method: string, path: string, init: RequestInit = {}): Request {
	return new Request(`${BASE}${path}`, { method, ...init });
}

async function summarise(response: Response): Promise<Summary> {
	return {
		status: response.status,
		etag: response.headers.get('ETag'),
		contentType: response.headers.get('Content-Type'),
		body: await response.text()
	};
}

test('Stores and serves a PUT object', async () => {
	const handler = await loadFetchHandler();
	const put = { method: 'PUT', path: '/bucket/a.txt', contentType: 'text/plain', body: 'hello' };
	const stored = await summarise(
		await handler(
			request('PUT', put.path, { body: put.body, headers: { 'content-type': put.contentType } })
		)
	);
	const served = await summarise(await handler(request('GET', '/bucket/a.txt')));
	expect(stored).toEqual({ status: 200, etag: '"test-object"', contentType: null, body: '' });
	expect(served).toEqual({ status: 200, etag: null, contentType: 'text/plain', body: 'hello' });

	recordExampleCases(meta('stores-and-serves-a-put-object'), [
		{ name: 'PUT stores the object and returns its ETag', input: put, output: stored },
		{
			name: 'GET returns the stored text with its content type',
			input: { method: 'GET', path: '/bucket/a.txt' },
			output: served
		}
	]);
});

test('Answers health checks and unknown objects', async () => {
	const handler = await loadFetchHandler();
	const health = await summarise(await handler(request('GET', '/health')));
	const missing = await summarise(await handler(request('GET', '/missing/key')));
	expect(health.status).toBe(200);
	expect(health.body).toBe('ok');
	expect(missing.status).toBe(404);
	expect(missing.body).toBe('not found');

	recordExampleCases(meta('answers-health-checks-and-unknown-objects'), [
		{ name: 'GET /health answers ok', input: { method: 'GET', path: '/health' }, output: health },
		{
			name: 'GET of an unknown key answers 404',
			input: { method: 'GET', path: '/missing/key' },
			output: missing
		}
	]);
});

test('Defaults the stored content type to octet-stream', async () => {
	const handler = await loadFetchHandler();
	const bytes = [1, 2, 3];
	await handler(request('PUT', '/bucket/blob.bin', { body: new Uint8Array(bytes) }));
	const response = await handler(request('GET', '/bucket/blob.bin'));
	const output = {
		status: response.status,
		contentType: response.headers.get('Content-Type'),
		bytes: [...new Uint8Array(await response.arrayBuffer())]
	};
	expect(output.contentType).toBe('application/octet-stream');
	expect(output.bytes).toEqual(bytes);

	recordExampleCases(meta('defaults-the-stored-content-type-to-octet-stream'), [
		{
			name: 'PUT without a content type then GET returns octet-stream',
			input: { method: 'PUT', path: '/bucket/blob.bin', bytes },
			output
		}
	]);
});

test('Rejects a request whose URL is not absolute', async () => {
	const handler = await loadFetchHandler();
	const relative = { method: 'GET', url: '/health', headers: new Headers() } as unknown as Request;
	let error: unknown;
	try {
		await handler(relative);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(TypeError);
	const actual = error as TypeError;

	recordExampleCases(meta('rejects-a-request-whose-url-is-not-absolute'), [
		{
			name: 'GET with a relative URL rejects with TypeError',
			input: { method: 'GET', url: '/health' },
			error: { name: actual.name, message: actual.message }
		}
	]);
});

test('Fails to load when the listener cannot start', async () => {
	const reason = 'listen EADDRINUSE: address already in use 127.0.0.1:5590';
	let error: unknown;
	try {
		await loadScript(() => {
			throw new Error(reason);
		});
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error;
	expect(actual.message).toBe(reason);

	recordExampleCases(meta('fails-to-load-when-the-listener-cannot-start'), [
		{
			name: 'Bun.serve throws on 127.0.0.1:5590 so the module fails to evaluate',
			input: { hostname: '127.0.0.1', port: 5590, listenerInUse: true },
			error: { name: actual.name, message: actual.message }
		}
	]);
});
