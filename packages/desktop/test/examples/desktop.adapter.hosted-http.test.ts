import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { HostedHttpAdapter } from '../../src/adapters/networking-security/hosted-http-adapter/HostedHttpAdapter';
import type {
	NativeHostedCredential,
	RemoteHttpOptions
} from '../../src/adapters/networking-security/hosted-http-adapter/HostedHttpAdapter.types';
import { HostedSessionRequiredError } from '../../src/adapters/networking-security/hosted-http-adapter/HostedSessionRequiredError';
import { InvalidHostedOriginError } from '../../src/adapters/networking-security/hosted-http-adapter/InvalidHostedOriginError';
import { UntrustedHostedRequestPathError } from '../../src/adapters/networking-security/hosted-http-adapter/UntrustedHostedRequestPathError';
import type { Call } from './desktop.adapter.hosted-http.test.types';

const origin = 'https://hosted.example.com';
const credential: NativeHostedCredential = {
	origin,
	principalId: 'principal-1',
	token: 'example-token'
};

const meta = (state: string, symbol: string) => ({
	unitId: 'desktop.adapter.hosted-http',
	symbol,
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

function fakeFetch(calls: Call[], status: number, body: unknown): typeof fetch {
	return ((input: string | URL | Request, init?: RequestInit) => {
		const headers = new Headers(init?.headers);
		calls.push({
			url: String(input),
			method: init?.method ?? 'GET',
			authorization: headers.get('authorization')
		});
		const json = { 'content-type': 'application/json' };
		return Promise.resolve(new Response(JSON.stringify(body), { status, headers: json }));
	}) as typeof fetch;
}

function adapterOptions(overrides: Partial<RemoteHttpOptions>): RemoteHttpOptions {
	return { origin, credentials: () => Promise.resolve(null), ...overrides };
}

async function errorOf(task: Promise<unknown>): Promise<unknown> {
	try {
		await task;
		return null;
	} catch (error) {
		return error;
	}
}

function errorOfSync(run: () => unknown): unknown {
	try {
		run();
		return null;
	} catch (error) {
		return error;
	}
}

function summarize(error: unknown) {
	return error instanceof Error
		? { name: error.name, message: error.message }
		: { name: 'UnknownError', message: String(error) };
}

test('Serves public status and JSON without a session', async () => {
	const calls: Call[] = [];
	const adapter = new HostedHttpAdapter(
		adapterOptions({ fetch: fakeFetch(calls, 200, { enabled: true }) })
	);
	const status = await adapter.publicStatus();
	const posted = await adapter.publicJson('/api/hosted/echo', ['first', 'second']);
	expect(status).toEqual({ enabled: true });
	expect(posted).toEqual({ enabled: true });
	expect(calls).toEqual([
		{ url: `${origin}/api/auth/status`, method: 'GET', authorization: null },
		{ url: `${origin}/api/hosted/echo`, method: 'POST', authorization: null }
	]);
	recordExampleCases(meta('serves-public-status-and-json-without-a-session', 'publicJson'), [
		{
			name: 'publicStatus requests auth status without a bearer token',
			input: { method: 'publicStatus' },
			output: { status, call: calls[0] }
		},
		{
			name: 'publicJson posts the body without a bearer token',
			input: { path: '/api/hosted/echo', body: ['first', 'second'] },
			output: { posted, call: calls[1] }
		}
	]);
});

test('Denies authorized JSON until the session is verified', async () => {
	const calls: Call[] = [];
	const denied: string[] = [];
	const onDenied = (principalId: string) => {
		denied.push(principalId);
		return Promise.resolve();
	};
	const stub = fakeFetch(calls, 200, {});
	const noSession = new HostedHttpAdapter(adapterOptions({ onDenied, fetch: stub }));
	const noSessionError = await errorOf(noSession.authorize());
	const foreign = { ...credential, origin: 'https://other.example.com' };
	const wrongOrigin = new HostedHttpAdapter(
		adapterOptions({ credentials: () => Promise.resolve(foreign), onDenied, fetch: stub })
	);
	const wrongOriginError = await errorOf(wrongOrigin.json('/api/projects/project-1'));
	const rejected = new HostedHttpAdapter(
		adapterOptions({
			credentials: () => Promise.resolve(credential),
			onDenied,
			fetch: fakeFetch(calls, 401, {})
		})
	);
	const rejectedError = await errorOf(rejected.json('/api/projects/project-1'));
	expect(noSessionError).toBeInstanceOf(HostedSessionRequiredError);
	expect(wrongOriginError).toBeInstanceOf(HostedSessionRequiredError);
	expect(rejectedError).not.toBeNull();
	expect(calls).toEqual([
		{ url: `${origin}/api/auth/status`, method: 'GET', authorization: 'Bearer example-token' }
	]);
	expect(denied).toEqual(['', 'principal-1', 'principal-1']);
	recordExampleCases(meta('denies-authorized-json-until-the-session-is-verified', 'json'), [
		{
			name: 'authorize without a credential asks for a session',
			input: { credential: null },
			error: summarize(noSessionError)
		},
		{
			name: 'json rejects a credential from another origin before any fetch',
			input: { path: '/api/projects/project-1', credentialOrigin: foreign.origin },
			error: summarize(wrongOriginError)
		},
		{
			name: 'json reports a 401 session check as denied',
			input: { path: '/api/projects/project-1', statusCode: 401 },
			error: summarize(rejectedError)
		}
	]);
});

test('Rejects untrusted origins and request paths', async () => {
	const calls: Call[] = [];
	const adapter = new HostedHttpAdapter(adapterOptions({ fetch: fakeFetch(calls, 200, {}) }));
	const insecure = errorOfSync(
		() => new HostedHttpAdapter(adapterOptions({ origin: 'http://hosted.example.com' }))
	);
	const withPath = errorOfSync(
		() => new HostedHttpAdapter(adapterOptions({ origin: 'https://hosted.example.com/extra' }))
	);
	const outside = await errorOf(adapter.request('/other/status', credential));
	const absolute = await errorOf(
		adapter.request('https://evil.example.com/api/auth/status', credential)
	);
	expect(insecure).toBeInstanceOf(InvalidHostedOriginError);
	expect(withPath).toBeInstanceOf(InvalidHostedOriginError);
	expect(outside).toBeInstanceOf(UntrustedHostedRequestPathError);
	expect(absolute).toBeInstanceOf(UntrustedHostedRequestPathError);
	expect(calls).toEqual([]);
	recordExampleCases(meta('rejects-untrusted-origins-and-request-paths', 'request'), [
		{
			name: 'Constructor rejects plain HTTP for a public host',
			input: { origin: 'http://hosted.example.com' },
			error: summarize(insecure)
		},
		{
			name: 'Constructor rejects an origin that includes a path',
			input: { origin: 'https://hosted.example.com/extra' },
			error: summarize(withPath)
		},
		{
			name: 'request rejects a path outside /api/ before fetch',
			input: { path: '/other/status' },
			error: summarize(outside)
		},
		{
			name: 'request rejects an absolute URL to another host before fetch',
			input: { path: 'https://evil.example.com/api/auth/status' },
			error: summarize(absolute)
		}
	]);
});
