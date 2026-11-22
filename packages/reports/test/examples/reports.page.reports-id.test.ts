import { isRedirect } from '@sveltejs/kit';
import { test } from 'vitest';
import { load } from '../../src/routes/reports/[id]/+page.server';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

/** The part of a thrown SvelteKit redirect that the route answers with. */
type Redirected = { status: number; location: string };
/** The part of a thrown error that the route can answer with. */
type Failed = { name: string; message: string };

/**
 * The real load of /reports/[id], called the way SvelteKit calls a page load: with its params.
 * load never returns; it ends by throwing, so the thrown value is what it answered with.
 */
function callLoad(id: string): { output: Redirected } | { error: Failed } {
	try {
		load({ params: { id } });
	} catch (thrown) {
		if (isRedirect(thrown)) return { output: { status: thrown.status, location: thrown.location } };
		const error = thrown as Error;
		return { error: { name: error.name, message: error.message } };
	}
	throw new Error('load returned without ending in a redirect or an error');
}

/** The evidence of one state: its cases, under the unit and the load function they show. */
const where = (state: string) => ({
	unitId: 'reports.page.reports-id',
	symbol: 'load',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

test('Redirects a legacy report id with a 308 to its explorer address', () => {
	const ids = ['rpt-1042', 'rpt-88117', 'rpt 7/ü'];
	const cases = ids.map((id) => ({
		name: `a former report address for ${JSON.stringify(id)} is requested`,
		input: { params: { id } },
		...callLoad(id)
	}));
	recordExampleCases(where('redirects-a-legacy-report-id-with-a-308-to-its-explorer-addr'), cases);
	expect(cases[0]).toEqual({
		name: 'a former report address for "rpt-1042" is requested',
		input: { params: { id: 'rpt-1042' } },
		output: { status: 308, location: '/harness/reports/rpt-1042' }
	});
	expect(cases[1]).toMatchObject({
		output: { status: 308, location: '/harness/reports/rpt-88117' }
	});
	// The id is percent-encoded: the space, the slash and the non-ASCII letter are all escaped.
	expect(cases[2]).toMatchObject({
		output: { status: 308, location: '/harness/reports/rpt%207%2F%C3%BC' }
	});
});

test('Throws a URIError instead of redirecting for an id with a lone surrogate', () => {
	const ids = ['rpt-1042-\uD83D', 'rpt-\uDE00'];
	const cases = ids.map((id) => ({
		name: `a former report address with the unpaired surrogate ${JSON.stringify(id)} is requested`,
		input: { params: { id } },
		...callLoad(id)
	}));
	recordExampleCases(where('throws-a-urierror-instead-of-redirecting-for-an-id-with-a-lo'), cases);
	expect(cases[0]).toEqual({
		name: 'a former report address with the unpaired surrogate "rpt-1042-\\ud83d" is requested',
		input: { params: { id: 'rpt-1042-\uD83D' } },
		error: { name: 'URIError', message: 'URI malformed' }
	});
	expect(cases[1]).toMatchObject({ error: { name: 'URIError', message: 'URI malformed' } });
	expect(cases.every((entry) => !('output' in entry))).toBe(true);
});
