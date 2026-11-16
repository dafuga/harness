import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { ProviderSwitchService } from '../../src/services/agents-providers/ProviderSwitchService';
import { PickerPreviewService } from '../../src/cli/program/codex-picker-command/PickerPreviewService';

type Cases = Parameters<typeof recordExampleCases>[1];

const origin = 'http://localhost';
const markup = '<html><body>Model picker</body></html>';
const unusedService = {} as ProviderSwitchService;

function service(html: string | (() => Promise<string>) = markup): PickerPreviewService {
	return new PickerPreviewService(unusedService, html, origin);
}

function record(state: string, cases: Cases): void {
	recordExampleCases(
		{
			unitId: 'service.picker-preview',
			symbol: 'fetch',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

function toolRequest(body: string, requestOrigin: string = origin): Request {
	return new Request(`${origin}/tools`, {
		method: 'POST',
		headers: { origin: requestOrigin, 'content-type': 'application/json' },
		body
	});
}

test('Serves preview HTML with the marker and no-store policy', async () => {
	const response = await service().fetch(new Request(`${origin}/preview`));
	const text = await response.text();

	expect(response.status).toBe(200);
	expect(text).toContain('<body data-picker-preview="true">');
	expect(response.headers.get('Cache-Control')).toBe('no-store');
	expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
	record('serves-preview-html-with-the-marker-and-no-store-policy', [
		{
			name: 'GET /preview on the configured origin',
			input: { method: 'GET', url: `${origin}/preview` },
			output: {
				status: response.status,
				contentType: response.headers.get('Content-Type'),
				cacheControl: response.headers.get('Cache-Control'),
				body: text
			}
		}
	]);
});

test('Rejects a request from a foreign host with 403', async () => {
	const response = await service().fetch(new Request('http://evil.example/preview'));
	const text = await response.text();

	expect(response.status).toBe(403);
	expect(text).toBe('Host rejected');
	record('rejects-a-request-from-a-foreign-host-with-403', [
		{
			name: 'GET /preview from another origin',
			input: { method: 'GET', url: 'http://evil.example/preview' },
			output: { status: response.status, body: text }
		}
	]);
});

test('Rejects a POST whose Origin header does not match', async () => {
	const response = await service().fetch(toolRequest('{}', 'http://evil.example'));
	const text = await response.text();

	expect(response.status).toBe(403);
	expect(text).toBe('Origin rejected');
	record('rejects-a-post-whose-origin-header-does-not-match', [
		{
			name: 'POST /tools with a foreign Origin header',
			input: { method: 'POST', url: `${origin}/tools`, origin: 'http://evil.example' },
			output: { status: response.status, body: text }
		}
	]);
});

test('Returns 400 for a session other than the synthetic one', async () => {
	const body = JSON.stringify({
		name: 'list_sessions',
		arguments: { session_id: 'real-session' }
	});
	const response = await service().fetch(toolRequest(body));
	const json = (await response.json()) as { error: string };

	expect(response.status).toBe(400);
	expect(json).toEqual({ error: 'Invalid preview request.' });
	record('returns-400-for-a-session-other-than-the-synthetic-one', [
		{
			name: 'POST /tools with session_id real-session',
			input: { name: 'list_sessions', arguments: { session_id: 'real-session' } },
			output: { status: response.status, body: json }
		}
	]);
});

test('Propagates a rejected HTML supplier', async () => {
	const failing = service(() => Promise.reject(new Error('markup unavailable')));
	let error: unknown;
	try {
		await failing.fetch(new Request(`${origin}/preview`));
	} catch (caught) {
		error = caught;
	}

	expect(error).toBeInstanceOf(Error);
	expect((error as Error).message).toBe('markup unavailable');
	record('propagates-a-rejected-html-supplier', [
		{
			name: 'GET /preview when the markup supplier rejects',
			input: { method: 'GET', url: `${origin}/preview` },
			error: { name: (error as Error).name, message: (error as Error).message }
		}
	]);
});
