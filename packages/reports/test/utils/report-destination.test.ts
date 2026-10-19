import { expect, test } from 'vitest';
import type { HarnessLegacyReport } from '../../src/models/Harness.types';
import { reportDestination } from '../../src/routes/harness/reports/[id]/reportDestination';
import { history, sha, summary } from '../explorerFixture';

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

test('a report that names a commit of this history opens Pages at that commit', () => {
	expect(reportDestination(index, { id: 'run-1', revision: sha('b') })).toBe(
		`/branch/main/commit/${sha('b')}/pages`
	);
	expect(reportDestination(index, { id: 'run-2', revision: sha('e') })).toBe(
		`/commit/${sha('e')}/pages`
	);
});

test('a report the history imported is found by its id', () => {
	expect(reportDestination(index, { id: 'imported-run' })).toBe(
		`/branch/main/commit/${sha('b')}/pages`
	);
});

test('a report that names no commit of this history opens Pages at the branch tip', () => {
	expect(reportDestination(index, { id: 'run-3', revision: sha('f') })).toBe('/branch/main/pages');
	expect(reportDestination(index, { id: 'run-4', revision: 'not a commit' })).toBe(
		'/branch/main/pages'
	);
	expect(reportDestination(index, { id: 'loose-run' })).toBe('/branch/main/pages');
	expect(reportDestination(index, null)).toBe('/branch/main/pages');
});

test('without a history there is only the root of the explorer to go to', () => {
	expect(reportDestination(null, { id: 'run-1', revision: sha('b') })).toBe('');
	expect(reportDestination(history(), null)).toBe('');
});
