import { expect, test } from 'vitest';
import type { ExplorerScope } from '../../src/models/Explorer.types';
import type { HarnessCapture, HarnessRevision } from '../../src/models/Harness.types';
import { explorerEvidence } from '../../src/utils/explorerEvidence';
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

test('each side says how every state of every scenario stands, from the one record that judges it', () => {
	const shown = explorerEvidence(
		scope('commit'),
		{ head: at(sha('a')), parent: at(sha('b')) },
		page
	);
	expect(shown.after.coverage.map((item) => [item.scenario, item.standing])).toEqual([
		['titles-page', 'passed']
	]);
	expect(shown.before?.coverage[0].states.map((state) => state.standing)).toEqual(['passed']);
	const bare = explorerEvidence(
		scope('current'),
		{ head: revision([page], [declared()], []), parent: null },
		page
	);
	expect(bare.after.coverage[0]).toMatchObject({ standing: 'missing' });
});

test('what a commit removed stays selectable: scenarios, states and viewports of both sides are united', () => {
	const wide = { id: 'wide', width: 1920, height: 1080 };
	const earlier = declared({
		states: [
			{ id: 'empty', coverage: 'required' },
			{ id: 'legacy', coverage: 'required' }
		],
		viewports: [...declared().viewports, wide]
	});
	const dropped = declared({ id: 'old-flow', title: 'Old flow' });
	const parent = revision([page], [earlier, dropped], [], { commit: sha('b') });
	const shown = explorerEvidence(scope('commit'), { head: at(sha('a')), parent }, page);
	expect(shown.scenarios.map((item) => item.id)).toEqual(['titles-page', 'old-flow']);
	expect(shown.scenarios[0].states.map((state) => state.id)).toEqual(['empty', 'legacy']);
	expect(shown.scenarios[0].viewports.map((viewport) => viewport.id)).toEqual([
		'desktop',
		'mobile',
		'wide'
	]);
	// At a tip nothing of a parent is united in: there is no before.
	const tip = explorerEvidence(scope('current'), { head: at(sha('a')), parent }, page);
	expect(tip.scenarios.map((item) => item.id)).toEqual(['titles-page']);
});

test('two sides are like for like only under one profile, equal viewport sizes and the same tests', () => {
	const pair = (parent: HarnessRevision) =>
		explorerEvidence(scope('commit'), { head: at(sha('a')), parent }, page).incomparable;
	expect(pair(at(sha('b')))).toEqual([]);
	const other = at(sha('b'));
	other.records[0].profile = 'p2';
	expect(pair(other)).toEqual([
		'The two sides were recorded under different profiles (p2 and p1).'
	]);
	const resized = at(sha('b'));
	resized.registry.scenarios = [
		declared({ viewports: [{ id: 'desktop', width: 1280, height: 800 }] })
	];
	expect(pair(resized)).toEqual([
		'Titles page: viewport desktop is 1280×800 before and 1440×900 after.'
	]);
	const retested = at(sha('b'));
	retested.registry.scenarios = [
		declared({ tests: [{ id: 'page', kind: 'e2e', runner: 'command' }] })
	];
	expect(pair(retested)).toEqual(['Titles page runs other tests after than before.']);
	expect(
		explorerEvidence(scope('current'), { head: at(sha('a')), parent: null }, page).incomparable
	).toEqual([]);
});
