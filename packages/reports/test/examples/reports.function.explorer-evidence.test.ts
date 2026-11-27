import { test } from 'vitest';
import type { ExplorerScope } from '../../src/models/explorer-ui/Explorer.types';
import { shortCommit } from '../../src/helpers/strings/shortCommit';
import { explorerEvidence } from '../../src/utils/explorer-ui/explorerEvidence';
import {
	complete,
	declared,
	record,
	result,
	revision,
	sha,
	summary,
	unit
} from '../explorerFixture';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type { Capture, Side } from './reports.function.explorer-evidence.test.types';

const page = unit('page.titles', 'page');
const built = (commit: string) =>
	complete().map((item) => ({
		...item,
		server: { buildId: `build-${commit[0]}`, revision: commit }
	}));

/** A revision whose one record captured the page from the build of its own commit. */
function at(commit: string) {
	const made = record([result(built(commit), { testedRevision: commit })], {
		id: `r-${commit[0]}`,
		source: { commit, base: null }
	});
	return revision([page], [declared()], [made], { commit });
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

const describe = (item: Capture) => ({
	scenario: item.scenario,
	state: item.state,
	viewport: item.capture.viewport,
	standing: item.standing,
	usable: item.usable,
	current: item.current,
	inheritedFrom: item.inheritedFrom
});

/** A side reduced to what it says about its own commit, so gaps are compared without their captures. */
const gapOf = (side: Side | null) =>
	side === null ? null : { commit: side.commit, gap: side.gap, captures: side.captures.length };

/** Records one named symbol's cases as a trace of their inputs and results. */
function trace(state: string, list: Array<[name: string, input: unknown, output: unknown]>) {
	return recordExampleCases(
		{
			unitId: 'reports.function.explorer-evidence',
			symbol: 'explorerEvidence',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		list.map(([name, input, output]) => ({ name, input, output }))
	);
}

const descriptorState = 'explorer-evidence-captured-descriptors';
test('each captured screen of the page is a descriptor with its standing, usable and current flags', () => {
	const shown = explorerEvidence(
		scope('commit'),
		{ head: at(sha('a')), parent: at(sha('b')) },
		page
	);
	const after = shown.after.captures.map(describe);
	const before = shown.before?.captures.map(describe) ?? [];
	expect(after).toEqual([
		{
			scenario: 'titles-page',
			state: 'empty',
			viewport: 'desktop',
			standing: 'fresh',
			usable: true,
			current: true,
			inheritedFrom: null
		},
		{
			scenario: 'titles-page',
			state: 'empty',
			viewport: 'mobile',
			standing: 'fresh',
			usable: true,
			current: true,
			inheritedFrom: null
		}
	]);
	expect(before).toHaveLength(2);
	expect(before.every((item) => item.current && item.usable)).toBe(true);
	trace(descriptorState, [
		[
			'after: the head commit screens',
			{ commit: sha('a'), mode: 'commit', parent: sha('b') },
			after
		],
		['before: the first parent screens', { commit: sha('b'), role: 'parent' }, before]
	]);
});

const stableState = 'explorer-evidence-stable-before-and-after-selection';
test('the same request reads the same sides again, and the after side does not depend on the before', () => {
	const head = at(sha('a'));
	const parent = at(sha('b'));
	const pinned = explorerEvidence(scope('commit'), { head, parent }, page);
	const again = explorerEvidence(scope('commit'), { head, parent }, page);
	const tip = explorerEvidence(scope('current'), { head, parent }, page);
	expect(again).toEqual(pinned);
	expect(pinned.after.commit).toBe(sha('a'));
	expect(pinned.before?.commit).toBe(sha('b'));
	expect(tip.before, 'a branch tip has no before side').toBeNull();
	expect(tip.initial).toBeNull();
	expect(tip.after, 'the after side is the same with or without a parent').toEqual(pinned.after);
	trace(stableState, [
		[
			'same request twice',
			{ commit: sha('a'), mode: 'commit' },
			again.after.captures.map(describe)
		],
		['before side is its own commit', { commit: sha('b') }, pinned.before?.commit ?? null],
		['tip has no before', { mode: 'current' }, { before: tip.before, initial: tip.initial }],
		['tip after matches pinned after', { mode: 'current' }, tip.after.captures.map(describe)]
	]);
});

const gapState = 'explorer-evidence-missing-links-are-gaps';
test('a missing parent, a parent of another commit and a first commit are gaps, never substitutes', () => {
	const head = at(sha('a'));
	const unread = explorerEvidence(scope('commit'), { head, parent: undefined }, page);
	const other = explorerEvidence(scope('commit'), { head, parent: at(sha('c')) }, page);
	const initial = explorerEvidence(scope('commit', null), { head, parent: null }, page);
	const headless = explorerEvidence(
		scope('commit'),
		{ head: at(sha('c')), parent: at(sha('b')) },
		page
	);
	const bare = explorerEvidence(
		scope('commit'),
		{ head: revision([page], [declared()], [], { commit: sha('a') }), parent: null },
		page
	);
	expect(gapOf(unread.before)).toEqual({
		commit: sha('b'),
		gap: `Revision ${shortCommit(sha('b'))} is not available here; no other revision is shown in its place.`,
		captures: 0
	});
	expect(unread.before?.detail).toBeNull();
	expect(other.before?.gap).toContain('is not available here');
	expect(other.before?.captures).toEqual([]);
	expect(initial.before).toBeNull();
	expect(initial.initial).toContain('first commit');
	expect(headless.after.detail).toBeNull();
	expect(headless.after.captures).toEqual([]);
	expect(bare.after.gap).toBe('No verification record is attached to this commit.');
	trace(gapState, [
		['parent not yet read', { commit: sha('a'), parent: 'undefined' }, gapOf(unread.before)],
		['parent of another commit', { commit: sha('b'), parent: sha('c') }, gapOf(other.before)],
		['first commit has no parent', { commit: sha('a'), parent: null }, initial.initial],
		['head of another commit', { commit: sha('a'), head: sha('c') }, gapOf(headless.after)],
		['head with no record', { commit: sha('a'), record: null }, gapOf(bare.after)]
	]);
});
