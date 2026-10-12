import { expect, test } from 'vitest';
import type { ExplorerEvidence, ExplorerSide } from '../../src/models/Explorer.types';
import type { HarnessCapture } from '../../src/models/Harness.types';
import { explorerBehavior } from '../../src/utils/explorerBehavior';
import { capture, declared, record, sha } from '../explorerFixture';

const output = (hash: string, extra: Partial<HarnessCapture> = {}) =>
	capture({
		evidence: 'output',
		kind: 'output',
		state: 'default',
		viewport: undefined,
		sha256: hash.repeat(64),
		mediaType: 'application/json',
		media: `media/${hash.repeat(64)}.json`,
		...extra
	});
const clock = declared({
	id: 'clock',
	title: 'Clock',
	kind: 'headless',
	units: ['service.clock'],
	viewports: []
});
function side(commit: string, captures: HarnessCapture[], profile = 'p1'): ExplorerSide {
	return {
		commit,
		detail: null,
		record: record([], { id: `r-${commit[0]}`, profile, source: { commit, base: null } }),
		captures: captures.map((item) => ({
			scenario: 'clock',
			state: item.state,
			capture: item,
			standing: 'fresh' as const,
			usable: item.status === 'passed' && item.media !== null,
			current: item.status === 'passed' && item.media !== null,
			inheritedFrom: null
		})),
		coverage: [],
		gap: null
	};
}
/** What explorerEvidence says of two sides recorded under different profiles. */
const differing = (before: ExplorerSide | null, after: ExplorerSide) =>
	before?.record && before.record.profile !== after.record?.profile
		? [
				`The two sides were recorded under different profiles (${before.record.profile} and ${after.record?.profile}).`
			]
		: [];
const compared = (
	before: ExplorerSide | null,
	after: ExplorerSide,
	initial: string | null = null
) =>
	explorerBehavior({
		mode: 'commit',
		scenarios: [clock],
		incomparable: differing(before, after),
		after,
		before,
		initial
	} as ExplorerEvidence);

test('equal recorded bytes on both sides are unchanged behaviour', () => {
	const shown = compared(side(sha('b'), [output('1')]), side(sha('a'), [output('1')]));
	expect(shown).toMatchObject({ mode: 'commit', summary: 'unchanged', reason: null });
	expect(shown.rows).toEqual([
		expect.objectContaining({
			scenario: 'clock',
			state: 'default',
			kind: 'output',
			change: 'unchanged'
		})
	]);
});

test('different bytes only differ: what they hold decides whether behaviour changed', () => {
	const shown = compared(side(sha('b'), [output('1')]), side(sha('a'), [output('2')]));
	expect(shown.summary).toBe('differs');
	expect(shown.reason).toBe(
		'The recorded results differ in bytes; reading them says whether the behaviour does.'
	);
	expect(shown.rows[0]).toMatchObject({ change: 'differs', differences: [] });
	expect(shown.rows[0].before?.sha256).toBe('1'.repeat(64));
	expect(shown.rows[0].after?.sha256).toBe('2'.repeat(64));
});

test('the states of both sides are united: one that appears or goes is a change', () => {
	const extra = output('3', { state: 'leap' });
	const added = compared(side(sha('b'), [output('1')]), side(sha('a'), [output('1'), extra]));
	expect(added.rows.map((row) => [row.state, row.change])).toEqual([
		['default', 'unchanged'],
		['leap', 'added']
	]);
	expect(added.summary).toBe('changed');
	const removed = compared(side(sha('b'), [output('1'), extra]), side(sha('a'), [output('1')]));
	expect(removed.rows.map((row) => [row.state, row.change])).toEqual([
		['default', 'unchanged'],
		['leap', 'removed']
	]);
});

test('nothing recorded on either side cannot establish that behaviour is unchanged', () => {
	const shown = compared(side(sha('b'), []), side(sha('a'), []));
	expect(shown).toMatchObject({ summary: 'unknown', rows: [] });
	expect(shown.reason).toBe(
		'Neither side recorded an output, assertions or a trace for this unit.'
	);
});

test('a side that has no usable record or result leaves the behaviour unknown', () => {
	const rejected = output('1', { status: 'failed' });
	const shown = compared(side(sha('b'), [rejected]), side(sha('a'), [output('1')]));
	expect(shown.summary).toBe('unknown');
	expect(shown.rows[0]).toMatchObject({ before: null, change: 'unknown' });
	const gap = {
		...side(sha('b'), []),
		record: null,
		gap: 'No verification record is attached to this commit.'
	};
	const missing = compared(gap, side(sha('a'), [output('1')]));
	expect(missing).toMatchObject({
		summary: 'unknown',
		reason: 'No verification record is attached to this commit.'
	});
});

test('records of different profiles are not compared', () => {
	const shown = compared(side(sha('b'), [output('1')], 'p1'), side(sha('a'), [output('1')], 'p2'));
	expect(shown.summary).toBe('unknown');
	expect(shown.reason).toBe('The two sides were recorded under different profiles (p1 and p2).');
});

test('a first commit and a branch tip compare nothing', () => {
	const first = compared(null, side(sha('a'), [output('1')]), 'This is the first commit.');
	expect(first).toMatchObject({ summary: 'not-compared', reason: 'This is the first commit.' });
	expect(first.rows[0]).toMatchObject({ before: null, change: 'unknown' });
	const tip = explorerBehavior({
		mode: 'current',
		scenarios: [clock],
		incomparable: [],
		after: side(sha('a'), [output('1')]),
		before: null,
		initial: null
	});
	expect(tip).toMatchObject({ mode: 'current', summary: 'not-compared', reason: null });
	expect(tip.rows).toHaveLength(1);
});

test('screenshots and audio are not behaviour results; scenarios keep their own outcome', () => {
	const after = side(sha('a'), [output('1'), capture()]);
	const shown = compared(side(sha('b'), [output('1')]), after);
	expect(shown.rows.map((row) => row.kind)).toEqual(['output']);
	expect(shown.scenarios).toEqual([{ id: 'clock', title: 'Clock', before: null, after: null }]);
});
