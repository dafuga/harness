import { expect, test } from 'vitest';
import type { ExplorerScope } from '../../src/models/Explorer.types';
import type { HarnessCapture, HarnessRevision } from '../../src/models/Harness.types';
import { explorerEvidence } from '../../src/utils/explorerEvidence';
import {
	capture,
	complete,
	declared,
	impacted,
	record,
	result,
	revision,
	sha,
	summary,
	unit
} from '../explorerFixture';

const page = unit('page.titles', 'page');
const built = (commit: string, captures: HarnessCapture[] = complete()) =>
	captures.map((item) => ({
		...item,
		server: { buildId: `build-${commit[0]}`, revision: commit }
	}));
/** A revision whose one record captured the page from its own build. */
function at(commit: string, extra: Partial<HarnessRevision> = {}): HarnessRevision {
	const made = record([result(built(commit), { testedRevision: commit })], {
		id: `r-${commit[0]}`,
		source: { commit, base: null }
	});
	return revision([page], [declared()], [made], { commit, ...extra });
}
function scope(mode: 'current' | 'commit', parent: string | null = sha('b')): ExplorerScope {
	return {
		location: { branch: 'main', commit: mode === 'commit' ? sha('a') : null, category: 'pages' },
		mode,
		branch: 'main',
		tip: sha('a'),
		commit: sha('a'),
		atTip: true,
		parent,
		summary: summary(sha('a'), { parents: parent ? [parent] : [] })
	};
}

test('a branch tip is shown with one set of captures and never a pair', () => {
	const shown = explorerEvidence(
		scope('current'),
		{ head: at(sha('a')), parent: at(sha('b')) },
		page
	);
	expect(shown).toMatchObject({ mode: 'current', before: null, initial: null });
	expect(shown.after).toMatchObject({ commit: sha('a'), gap: null, record: { id: 'r-a' } });
	expect(
		shown.after.captures.map((item) => [item.state, item.capture.viewport, item.usable])
	).toEqual([
		['empty', 'desktop', true],
		['empty', 'mobile', true]
	]);
	expect(shown.scenarios.map((item) => item.id)).toEqual(['titles-page']);
});

test('a selected commit is paired with its first parent, each side from its own record', () => {
	const shown = explorerEvidence(
		scope('commit'),
		{ head: at(sha('a')), parent: at(sha('b')) },
		page
	);
	expect(shown.before).toMatchObject({ commit: sha('b'), gap: null, record: { id: 'r-b' } });
	expect(shown.before?.captures.every((item) => item.capture.server?.revision === sha('b'))).toBe(
		true
	);
	expect(shown.after.captures.every((item) => item.capture.server?.revision === sha('a'))).toBe(
		true
	);
});

test('a revision that is not the first parent is never shown as before', () => {
	const later = explorerEvidence(
		scope('commit'),
		{ head: at(sha('a')), parent: at(sha('c')) },
		page
	);
	expect(later.before).toMatchObject({
		commit: sha('b'),
		detail: null,
		record: null,
		captures: []
	});
	expect(later.before?.gap).toContain('bbbbbbb');
	const absent = explorerEvidence(scope('commit'), { head: at(sha('a')), parent: null }, page);
	expect(absent.before).toMatchObject({ commit: sha('b'), detail: null, captures: [] });
});

test('a first commit has no before, and says so', () => {
	const shown = explorerEvidence(scope('commit', null), { head: at(sha('a')), parent: null }, page);
	expect(shown.before).toBeNull();
	expect(shown.initial).toBe(
		'This is the first commit of its history: there is no parent to compare with.'
	);
});

test('a revision other than the shown commit is refused as after', () => {
	const shown = explorerEvidence(scope('current'), { head: at(sha('c')), parent: null }, page);
	expect(shown.after).toMatchObject({ commit: sha('a'), detail: null, captures: [] });
	expect(shown.after.gap).toContain('aaaaaaa');
});

test('an older capture is not current: a rejected, stale or unstored one is listed and unusable', () => {
	const mixed = [
		capture({ status: 'failed' }),
		capture({ viewport: 'mobile', server: { buildId: 'build-0', revision: sha('9') } }),
		capture({ viewport: 'tablet', media: null, gap: 'not stored' })
	];
	const head = revision([page], [declared()], [record([result(mixed)])]);
	const shown = explorerEvidence(scope('current'), { head, parent: null }, page);
	expect(
		shown.after.captures.map((item) => [item.capture.viewport, item.usable, item.standing])
	).toEqual([
		['desktop', false, 'rejected'],
		['mobile', false, 'fresh'],
		['tablet', false, 'fresh']
	]);
	expect(shown.after.gap).toBe(
		'No capture of this commit can be used: each is rejected, stale or not stored.'
	);
});

test('inherited captures say where they came from, and stand only while nothing affects the unit', () => {
	const origin = { record: 'r0', commit: sha('b') };
	const inherited = record([
		result(built(sha('b')), {
			status: 'referenced',
			inherited: true,
			originTests: [{ id: 'titles-page:page', status: 'passed' }],
			testedRevision: sha('b'),
			origin
		})
	]);
	const head = revision([page], [declared()], [inherited], { sourceImpact: impacted(sha('b')) });
	const shown = explorerEvidence(scope('current'), { head, parent: null }, page);
	// Inherited proof may stand, and is never the current capture of this commit.
	expect(
		shown.after.captures.map((item) => [item.inheritedFrom, item.usable, item.current])
	).toEqual([
		[sha('b'), true, false],
		[sha('b'), true, false]
	]);
	const changed = { ...head, sourceImpact: impacted(sha('b'), ['page.titles']) };
	const stale = explorerEvidence(scope('current'), { head: changed, parent: null }, page);
	expect(stale.after.captures.every((item) => !item.usable && !item.current)).toBe(true);
	const unknown = explorerEvidence(
		scope('current'),
		{ head: { ...head, sourceImpact: null }, parent: null },
		page
	);
	expect(unknown.after.captures.every((item) => !item.usable)).toBe(true);
	const fresh = explorerEvidence(scope('current'), { head: at(sha('a')), parent: null }, page);
	expect(fresh.after.captures.every((item) => item.usable && item.current)).toBe(true);
});

test('a side without a registry, a record or a covering scenario states the gap', () => {
	const gap = (head: HarnessRevision) =>
		explorerEvidence(scope('current'), { head, parent: null }, page).after.gap;
	expect(gap(revision([page], [declared()], []))).toBe(
		'No verification record is attached to this commit.'
	);
	expect(gap(revision([page], [], [record([])]))).toBe(
		'No scenario covers this unit at this commit.'
	);
	const none = revision([], [], []);
	none.registry = { ...none.registry, available: false, gap: 'No registry here' };
	expect(gap(none)).toBe('No registry here');
	const invalid = revision([page], [declared()], [record([result(complete())], { valid: false })]);
	expect(gap(invalid)).toContain('could be validated');
});
