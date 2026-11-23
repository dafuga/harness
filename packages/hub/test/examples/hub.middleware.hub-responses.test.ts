import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { HubResponsesMiddleware } from '../../src/lib/development-tooling/server-hooks/HubResponsesMiddleware';

const UNIT_ID = 'hub.middleware.hub-responses';
const SUMMARISED_HEADERS = [
	'X-Frame-Options',
	'Content-Security-Policy',
	'Referrer-Policy',
	'X-Content-Type-Options',
	'Cache-Control',
	'X-Trace'
];

type RecordedCases = Parameters<typeof recordExampleCases>[1];

function summarise(response: Response) {
	return {
		status: response.status,
		headers: Object.fromEntries(
			SUMMARISED_HEADERS.map((name) => [name, response.headers.get(name)])
		)
	};
}

function errorOf(run: () => unknown): { name: string; message: string } {
	try {
		run();
	} catch (caught) {
		const error = caught as Error;
		return { name: error.name, message: error.message };
	}
	throw new Error('expected the call to throw');
}

function record(state: string, cases: RecordedCases) {
	recordExampleCases(
		{
			unitId: UNIT_ID,
			symbol: 'handle',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

test('Sets the five hardening headers in place', () => {
	const middleware = new HubResponsesMiddleware();
	const response = new Response('workspace', {
		status: 201,
		headers: { 'X-Frame-Options': 'SAMEORIGIN', 'X-Trace': 'abc' }
	});
	const input = summarise(response);
	const output = middleware.handle(response);

	expect(output).toBe(response);
	expect(output.headers.get('X-Frame-Options')).toBe('DENY');
	expect(output.headers.get('Content-Security-Policy')).toBe("frame-ancestors 'none'");
	expect(output.headers.get('Referrer-Policy')).toBe('no-referrer');
	expect(output.headers.get('X-Content-Type-Options')).toBe('nosniff');
	expect(output.headers.get('Cache-Control')).toBe('private, no-store');
	expect(output.headers.get('X-Trace')).toBe('abc');
	expect(output.status).toBe(201);

	record('sets-the-five-hardening-headers-in-place', [
		{
			name: 'mutable response gets five hardening headers and keeps status and X-Trace',
			input,
			output: summarise(output)
		}
	]);
});

test('Rejects a response with immutable headers', () => {
	const middleware = new HubResponsesMiddleware();
	const response = Response.redirect('https://hub.example.test/approve', 302);
	const input = summarise(response);
	const error = errorOf(() => middleware.handle(response));

	expect(error.name).toBe('TypeError');

	record('rejects-a-response-with-immutable-headers', [
		{
			name: 'redirect response with immutable headers throws TypeError from Headers.set',
			input,
			error
		}
	]);
});

test('Rejects when there is no response', () => {
	const middleware = new HubResponsesMiddleware();
	const error = errorOf(() => middleware.handle(null as unknown as Response));

	expect(error.name).toBe('TypeError');

	record('rejects-when-there-is-no-response', [
		{
			name: 'null response throws TypeError and no Response is returned',
			input: { response: null },
			error
		}
	]);
});
