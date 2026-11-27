import { test } from 'vitest';
import { reportDestination } from '../../src/routes/harness/reports/[id]/reportDestination';
import type { HarnessLegacyReport } from '../../src/models/explorer-ui/Harness.types';
import { history, sha, summary } from '../explorerFixture';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type { Cases } from './reports.function.report-destination.test.types';
const unitId = 'reports.function.report-destination';
const symbol = 'reportDestination';

/** Records one named call's cases as a trace of its inputs and results. */
function traceCases(state: string, cases: Cases): boolean {
	return recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
}

/** Runs one call and keeps what it threw, so a thrown error is recorded as a result. */
function outcome(call: () => string): { output: string } | { error: string } {
	try {
		return { output: call() };
	} catch (error) {
		return { error: String(error) };
	}
}

const imported = (id: string, linked: string | null) =>
	({ id, linked, revision: linked, title: id }) as unknown as HarnessLegacyReport;
const index = history({
	branches: [{ name: 'main', head: sha('c') }],
	revisions: [
		summary(sha('c'), { parents: [sha('b')] }),
		summary(sha('b'), { parents: [], branches: ['main', 'feature/x'] }),
		summary(sha('e'), { branches: [], retained: true })
	],
	legacy: [imported('imported-run', sha('b')), imported('loose-run', null)]
});
const ranked = history({
	revisions: [
		summary(sha('g'), { branches: ['feature/x', 'master'] }),
		summary(sha('h'), { branches: ['release', 'feature/y'] })
	]
});
const unpaired = history({
	revisions: [summary(sha('d'), { branches: ['bad\uD800branch'] })]
});

const emptyState = 'report-destination-empty-or-absent-history-is-empty-string';
test('an empty or missing history answers with an empty destination', () => {
	const found = {
		nullIndex: reportDestination(null, { id: 'run-1', revision: sha('b') }),
		noRevisions: reportDestination(history(), { id: 'run-1', revision: sha('b') }),
		nullReport: reportDestination(history(), null)
	};
	expect(found.nullIndex, 'a null index is empty').toBe('');
	expect(found.noRevisions, 'an index with no revisions is empty').toBe('');
	expect(found.nullReport, 'a null report with no revisions is empty').toBe('');
	traceCases(emptyState, [
		{
			name: 'null index with a report',
			input: { index: null, report: { id: 'run-1', revision: sha('b') } },
			output: found.nullIndex
		},
		{
			name: 'index with no revisions',
			input: { index: { revisions: [] }, report: { id: 'run-1', revision: sha('b') } },
			output: found.noRevisions
		},
		{
			name: 'no revisions and no report',
			input: { index: { revisions: [] }, report: null },
			output: found.nullReport
		}
	]);
});

const commitState = 'report-destination-recorded-revision-opens-its-commit';
test('a recorded revision the history holds opens Pages at its commit on a preferred branch', () => {
	const found = {
		mainBranch: reportDestination(index, { id: 'run-1', revision: sha('b') }),
		noBranch: reportDestination(index, { id: 'run-2', revision: sha('e') }),
		preferred: reportDestination(ranked, { id: 'run-3', revision: sha('g') }),
		firstBranch: reportDestination(ranked, { id: 'run-4', revision: sha('h') })
	};
	expect(found.mainBranch, 'main is preferred').toBe(`/branch/main/commit/${sha('b')}/pages`);
	expect(found.noBranch, 'no branch lists the commit').toBe(`/commit/${sha('e')}/pages`);
	expect(found.preferred, 'master is preferred').toBe(`/branch/master/commit/${sha('g')}/pages`);
	expect(found.firstBranch, 'the first branch is used without a preferred one').toBe(
		`/branch/release/commit/${sha('h')}/pages`
	);
	traceCases(commitState, [
		{
			name: 'commit on main and feature',
			input: { revision: sha('b') },
			output: found.mainBranch
		},
		{ name: 'commit on no branch', input: { revision: sha('e') }, output: found.noBranch },
		{
			name: 'commit preferring master',
			input: { revision: sha('g'), branches: ['feature/x', 'master'] },
			output: found.preferred
		},
		{
			name: 'commit on the first branch',
			input: { revision: sha('h'), branches: ['release', 'feature/y'] },
			output: found.firstBranch
		}
	]);
});

const linkState = 'report-destination-legacy-link-used-when-revision-not-held';
test('an imported legacy linkage is used when the recorded revision is not held', () => {
	const found = {
		byId: reportDestination(index, { id: 'imported-run' }),
		unknownRevision: reportDestination(index, { id: 'imported-run', revision: sha('f') }),
		recordedFirst: reportDestination(index, { id: 'imported-run', revision: sha('e') }),
		unlinked: reportDestination(index, { id: 'loose-run' })
	};
	expect(found.byId, 'the report is found by its id').toBe(`/branch/main/commit/${sha('b')}/pages`);
	expect(found.unknownRevision, 'an unheld revision falls back to the linkage').toBe(
		`/branch/main/commit/${sha('b')}/pages`
	);
	expect(found.recordedFirst, 'a held recorded revision comes before the linkage').toBe(
		`/commit/${sha('e')}/pages`
	);
	expect(found.unlinked, 'a report without a linked commit opens the home').toBe(
		'/branch/main/pages'
	);
	traceCases(linkState, [
		{ name: 'report found by its id', input: { id: 'imported-run' }, output: found.byId },
		{
			name: 'unheld revision uses the linkage',
			input: { id: 'imported-run', revision: sha('f') },
			output: found.unknownRevision
		},
		{
			name: 'held revision before the linkage',
			input: { id: 'imported-run', revision: sha('e') },
			output: found.recordedFirst
		},
		{ name: 'unlinked report opens the home', input: { id: 'loose-run' }, output: found.unlinked }
	]);
});

const homeState = 'report-destination-unknown-report-opens-explorer-home';
test('a report that names nothing the history holds opens the explorer home', () => {
	const found = {
		unknownRevision: reportDestination(index, { id: 'run-3', revision: sha('f') }),
		malformed: reportDestination(index, { id: 'run-4', revision: 'not a commit' }),
		nullReport: reportDestination(index, null),
		headless: reportDestination(history({ revisions: [summary(sha('k'), { branches: [] })] }), null)
	};
	expect(found.unknownRevision, 'an unknown commit opens the branch tip').toBe(
		'/branch/main/pages'
	);
	expect(found.malformed, 'a malformed revision opens the branch tip').toBe('/branch/main/pages');
	expect(found.nullReport, 'a null report opens the branch tip').toBe('/branch/main/pages');
	expect(found.headless, 'no branch gives the first commit as home').toBe(
		`/commit/${sha('k')}/pages`
	);
	traceCases(homeState, [
		{
			name: 'unknown revision opens the tip',
			input: { revision: sha('f') },
			output: found.unknownRevision
		},
		{
			name: 'malformed revision opens the tip',
			input: { revision: 'not a commit' },
			output: found.malformed
		},
		{ name: 'null report opens the tip', input: { report: null }, output: found.nullReport },
		{
			name: 'no branch gives the first commit',
			input: { branches: [] },
			output: found.headless
		}
	]);
});

const uriState = 'report-destination-unpaired-surrogate-branch-throws-uri-error';
test('a branch name with an unpaired surrogate throws URIError from the route address', () => {
	const found = outcome(() => reportDestination(unpaired, { id: 'run-5', revision: sha('d') }));
	expect(found, 'the encodeURIComponent failure is not caught').toEqual({
		error: 'URIError: URI malformed'
	});
	traceCases(uriState, [
		{
			name: 'branch with an unpaired surrogate',
			input: { revision: sha('d'), branches: ['bad\uD800branch'] },
			...found
		}
	]);
});
