import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, test } from 'vitest';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

// The report store and the history directory are read from the environment when the loader's
// modules first run, so both point at temporary folders before the loader is imported. Nothing
// here reads the environment; the folders are removed when the file's tests are done.
const reportsHome = mkdtempSync(join(tmpdir(), 'reports-page-id-store-'));
process.env.PROJECT_REPORTS_HOME = reportsHome;
const { load } = await import('../../src/routes/harness/reports/[id]/+page.server');

afterAll(() => {
	delete process.env.PROJECT_REPORTS_HOME;
	rmSync(reportsHome, { recursive: true, force: true });
});

const HELD = 'a1b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0';
const TIP = 'b2c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0e1';
const UNHELD = 'c3d4e5f6a7b8c9d0a1b2c3d4e5f6a7b8c9d0e1f2';

/** A history index as the console keeps it on disk: one branch at TIP, a held commit at HELD. */
function history(legacy: Array<{ id: string; linked: string | null }>) {
	return JSON.stringify({
		branches: [{ name: 'main', head: TIP }],
		revisions: [
			{ commit: HELD, branches: [], parents: [], records: [] },
			{ commit: TIP, branches: ['main'], parents: [HELD], records: [] }
		],
		legacy
	});
}

/** The loader run the way SvelteKit runs it: a minimal event, the stored index read from disk. */
async function loadWith(id: string, index: string | undefined) {
	const directory = mkdtempSync(join(tmpdir(), 'reports-page-id-console-'));
	try {
		if (index !== undefined) writeFileSync(join(directory, 'index.json'), index);
		process.env.HARNESS_CONSOLE_DATA = directory;
		try {
			await load({ params: { id } });
			return { resolved: true as const };
		} catch (error) {
			return { thrown: error };
		}
	} finally {
		delete process.env.HARNESS_CONSOLE_DATA;
		rmSync(directory, { recursive: true, force: true });
	}
}

/** The redirect SvelteKit throws, reduced to the status and location a caller relies on. */
function redirectOf(outcome: { thrown?: unknown }): { status: number; location: string } | null {
	const error = outcome.thrown;
	if (typeof error !== 'object' || error === null) return null;
	if (!('status' in error) || !('location' in error)) return null;
	return { status: Number(error.status), location: String(error.location) };
}

/** The evidence of one state: its cases, under the page and the loader they show. */
const where = (state: string) => ({
	unitId: 'reports.page.harness-reports-id',
	symbol: 'load',
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

test('Redirects to the commit a legacy report entry names', async () => {
	const id = 'legacy-report-42';
	const named = await loadWith(id, history([{ id, linked: HELD }]));
	const redirect = redirectOf(named);
	const unheld = await loadWith(id, history([{ id, linked: UNHELD }]));
	recordExampleCases(where('redirects-to-the-commit-a-legacy-report-entry-names'), [
		{
			name: 'a legacy link whose index entry names a commit the history holds',
			input: { params: { id }, index: { legacy: [{ id, linked: HELD }] } },
			output: redirect
		},
		{
			name: 'a legacy link whose index entry names a commit the history does not hold',
			input: { params: { id }, index: { legacy: [{ id, linked: UNHELD }] } },
			output: redirectOf(unheld)
		}
	]);
	expect(named.resolved).toBeUndefined();
	// The held commit has no branch in this index, so Pages opens at the commit alone.
	expect(redirect).toEqual({ status: 307, location: `/harness/commit/${HELD}/pages` });
});

test('Redirects to the branch tip when no held commit is named', async () => {
	const id = 'legacy-report-43';
	const unheld = await loadWith(id, history([{ id, linked: UNHELD }]));
	const unlisted = await loadWith('legacy-report-44', history([]));
	recordExampleCases(where('redirects-to-the-branch-tip-when-no-held-commit-is-named'), [
		{
			name: 'a legacy link that names a commit the history does not hold',
			input: { params: { id }, index: { legacy: [{ id, linked: UNHELD }] } },
			output: redirectOf(unheld)
		},
		{
			name: 'a report id that no index entry names',
			input: { params: { id: 'legacy-report-44' }, index: { legacy: [] } },
			output: redirectOf(unlisted)
		}
	]);
	expect(redirectOf(unheld)).toEqual({ status: 307, location: '/harness/branch/main/pages' });
	expect(redirectOf(unlisted)).toEqual({ status: 307, location: '/harness/branch/main/pages' });
});

test('Redirects to the explorer root when no index is stored', async () => {
	const outcome = await loadWith('legacy-report-45', undefined);
	recordExampleCases(where('redirects-to-the-explorer-root-when-no-index-is-stored'), [
		{
			name: 'a console with no index.json on disk',
			input: { params: { id: 'legacy-report-45' }, index: null },
			output: redirectOf(outcome)
		}
	]);
	expect(redirectOf(outcome)).toEqual({ status: 307, location: '/harness' });
});

test('Redirects to the explorer root when the history is empty', async () => {
	const outcome = await loadWith(
		'legacy-report-46',
		JSON.stringify({ branches: [], revisions: [], legacy: [] })
	);
	recordExampleCases(where('redirects-to-the-explorer-root-when-the-history-is-empty'), [
		{
			name: 'an index that holds no branch and no commit',
			input: { params: { id: 'legacy-report-46' }, index: { branches: [], revisions: [] } },
			output: redirectOf(outcome)
		}
	]);
	expect(redirectOf(outcome)).toEqual({ status: 307, location: '/harness' });
});

test('Throws SyntaxError when the stored index is not JSON', async () => {
	const outcome = await loadWith('legacy-report-47', 'not json');
	const error = outcome.thrown;
	recordExampleCases(where('throws-syntaxerror-when-the-stored-index-is-not-json'), [
		{
			name: 'a stored index.json that is not valid JSON',
			input: { params: { id: 'legacy-report-47' }, index: 'not json' },
			error: { name: error instanceof Error ? error.name : typeof error }
		}
	]);
	expect(error).toBeInstanceOf(SyntaxError);
	expect(outcome.resolved).toBeUndefined();
});
