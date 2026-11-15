import type { RequestEvent } from '@sveltejs/kit';
import { test } from 'vitest';
import { GET } from '../../src/routes/api/health/+server';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/**
 * The real GET of /api/health, called the way SvelteKit calls a GET handler: with an event that
 * carries a Request built here, so no server or port is involved. The handler reads neither, so
 * what it returns describes this server rather than the request.
 */
const handler: (event: RequestEvent) => Response | Promise<Response> = GET;

/** The evidence of one state: its cases, under the unit and the handler they show. */
const where = (state: string) => ({
	unitId: 'reports.endpoint.api-health',
	symbol: 'GET',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

test('GET called for /api/health answers 200 with JSON naming the report app, its version, its build, its verification revision and a hash of its repository root', async () => {
	const url = new URL('http://localhost/api/health');
	const response = await handler({ url, request: new Request(url) } as RequestEvent);
	const body = await response.json();
	recordExampleCases(where('health-identity'), [
		{
			name: 'a health probe requests /api/health',
			input: { method: 'GET', url: url.href },
			output: { status: response.status, body }
		}
	]);
	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toContain('application/json');
	// Run from source, the server has no compiled build; only a verification run sets a revision.
	expect(body).toMatchObject({
		app: 'project-reports',
		version: 1,
		buildId: 'harness-reports-development',
		revision: process.env.HARNESS_VERIFY_REVISION ?? null
	});
	expect(body.root).toMatch(/^[0-9a-f]{64}$/);
});
