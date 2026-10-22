import { expect, test } from 'vitest';
import type { ExplorerScope } from '../../src/models/Explorer.types';
import type { HarnessCapture, HarnessRevision } from '../../src/models/Harness.types';
import { explorerEvidence } from '../../src/utils/explorerEvidence';
import { comparisonChoices, harnessComparison } from '../../src/utils/harnessComparison';
import { harnessImpact } from '../../src/utils/harnessImpact';
import {
	legacyEvidence,
	legacyLink
} from '../../src/components/explorer-ui/harness/harness-legacy/legacyEvidence';
import type { HarnessLegacyReport } from '../../src/models/Harness.types';
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

test('the media gallery leaves a missing parent explicit and keeps the selected capture provenance', () => {
	const before = { detail: at(sha('b'), { records: [] }), record: null };
	const detail = at(sha('a'));
	const after = { detail, record: detail.records[0] };
	expect(comparisonChoices(before, after)).toEqual([
		{ scenario: 'titles-page', states: ['empty'], viewports: ['desktop', 'mobile'] }
	]);
	const { items, aligned } = harnessComparison(before, after, {
		scenario: 'titles-page',
		state: 'empty',
		viewport: 'desktop'
	});
	expect(items).toHaveLength(2);
	expect(items[0]).toMatchObject({ phase: 'before', missing: true });
	expect(items[1]).toMatchObject({ phase: 'after', missing: false });
	expect(items[1].provenance).toContainEqual({
		label: 'Captured from',
		value: expect.stringContaining('build-a')
	});
	expect(aligned[0].before).toContain('has no verification record');
});

test('registry comparison traces dependents through the removed unit without inventing a record', () => {
	const helper = unit('function.old', 'function');
	const consumer = unit('component.consumer', 'component', {
		dependencies: [{ unit: helper.id, via: 'import' }]
	});
	const before = revision([helper, consumer], [], [], { commit: sha('b') });
	const after = revision([consumer, unit('component.new', 'component')], [], []);
	expect(harnessImpact(before, after)).toMatchObject({
		source: 'computed',
		direct: [],
		indirect: [consumer.id],
		added: ['component.new'],
		removed: [helper.id]
	});
});

test('legacy media retain missing bytes and unknown status without becoming build verification', () => {
	const report: HarnessLegacyReport = {
		id: 'old-report',
		title: 'Imported report',
		mode: 'feature',
		environment: 'fixture',
		status: 'passed',
		startedAt: '2026-01-01T00:00:00Z',
		revision: null,
		linked: null,
		gap: 'No commit was recorded.',
		summary: '',
		checks: [],
		media: [{ id: 'missing', title: 'Old capture', status: 'invented', media: null }]
	};
	expect(legacyLink(report, sha('a'))).toBe('No commit was recorded.');
	expect(legacyLink({ ...report, linked: sha('b') }, sha('a'))).toBe('Recorded for bbbbbbb');
	const [item] = legacyEvidence(report);
	expect(item).toMatchObject({
		missing: true,
		file: '',
		status: 'not-proven',
		standing: 'Legacy report capture'
	});
	expect(item.provenance).toContainEqual({
		label: 'Captured from',
		value: 'not recorded: legacy reports name no build'
	});
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
