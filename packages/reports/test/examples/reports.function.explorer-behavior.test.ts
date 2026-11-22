import { test } from 'vitest';
import {
	behaviorKinds,
	behaviorSummary,
	explorerBehavior
} from '../../src/utils/explorer-ui/explorerBehavior';
import type { ExplorerSide } from '../../src/models/explorer-ui/Explorer.types';
import { capture, declared, record, result, sha } from '../explorerFixture';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';

type Shot = ReturnType<typeof capture>;
type Behavior = ReturnType<typeof explorerBehavior>;
type Row = Behavior['rows'][number];

const nothing = 'Neither side recorded an output, assertions or a trace for this unit.';
const unread =
	'The recorded results differ in bytes; reading them says whether the behaviour does.';
const doubtful = 'A result of one side is rejected, stale or not stored, so it cannot be compared.';
const clock = declared({ id: 'clock', title: 'Clock', kind: 'headless', units: [], viewports: [] });
const unit = { unitId: 'reports.function.explorer-behavior', evidence: 'examples-cases' };

const output = (hash: string, extra: Partial<Shot> = {}) =>
	capture({
		evidence: 'output',
		kind: 'output',
		state: 'default',
		viewport: undefined,
		sha256: hash.repeat(64),
		media: `media/${hash.repeat(64)}.json`,
		...extra
	});

/** One side; a result is usable when it passed and has media, as explorerEvidence sets it. */
function side(
	commit: string,
	captures: Shot[],
	profile = 'p1',
	scenarios: Array<ReturnType<typeof result>> = []
): ExplorerSide {
	const items = captures.map((item) => {
		const usable = item.status === 'passed' && item.media !== null;
		return {
			scenario: 'clock',
			state: item.state,
			capture: item,
			standing: 'fresh' as const,
			usable,
			current: usable,
			inheritedFrom: null
		};
	});
	const source = { commit, base: null };
	return {
		commit,
		detail: null,
		record: record(scenarios, { id: `r-${commit[0]}`, profile, source }),
		captures: items,
		coverage: [],
		gap: null
	};
}

/** Behaviour of two sides; explorerEvidence names mixed profiles as the incomparable reason. */
function compared(before: ExplorerSide | null, after: ExplorerSide, initial: string | null = null) {
	const incomparable =
		before?.record && before.record.profile !== after.record?.profile
			? [
					`The two sides were recorded under different profiles (${before.record.profile} and ${after.record?.profile}).`
				]
			: [];
	return explorerBehavior({
		mode: 'commit',
		scenarios: [clock],
		incomparable,
		after,
		before,
		initial
	});
}

/** The observable parts of a behaviour result, without the media bytes. */
const view = (shown: Behavior) => ({
	summary: shown.summary,
	reason: shown.reason,
	rows: shown.rows.map(({ state, kind, change }) => [state, kind, change]),
	scenarios: shown.scenarios
});
const changes = (shown: Behavior) => shown.rows.map((row) => [row.state, row.change]);

/** Records one named symbol's cases, each a name with its observed input and result. */
const trace = (symbol: string, state: string, list: Array<[string, unknown, unknown]>) =>
	recordExampleCases(
		{ ...unit, symbol, state, file: `${state}.json` },
		list.map(([name, input, output]) => ({ name, input, output }))
	);

test('equal recorded bytes on both sides are unchanged behaviour', () => {
	const shown = compared(side(sha('b'), [output('1')]), side(sha('a'), [output('1')]));
	expect(shown).toMatchObject({ mode: 'commit', summary: 'unchanged', reason: null });
	expect(changes(shown)).toEqual([['default', 'unchanged']]);
	trace('explorerBehavior', 'explorer-behavior-unchanged-bytes', [
		['equal bytes are unchanged', { before: '1', after: '1' }, view(shown)]
	]);
});

test('different bytes only differ: what they hold decides whether behaviour changed', () => {
	const shown = compared(side(sha('b'), [output('1')]), side(sha('a'), [output('2')]));
	expect(shown.summary).toBe('differs');
	expect(shown.reason).toBe(unread);
	expect(shown.rows[0]).toMatchObject({ change: 'differs', differences: [] });
	expect(shown.rows[0].before?.sha256).toBe('1'.repeat(64));
	expect(shown.rows[0].after?.sha256).toBe('2'.repeat(64));
	trace('explorerBehavior', 'explorer-behavior-differs-reads-bytes', [
		['different bytes differ', { before: '1', after: '2' }, view(shown)]
	]);
});

test('a result that appears or goes is added or removed and makes the summary changed', () => {
	const extra = output('3', { state: 'leap' });
	const added = compared(side(sha('b'), [output('1')]), side(sha('a'), [output('1'), extra]));
	const removed = compared(side(sha('b'), [output('1'), extra]), side(sha('a'), [output('1')]));
	expect(changes(added)).toEqual([
		['default', 'unchanged'],
		['leap', 'added']
	]);
	expect(changes(removed)).toEqual([
		['default', 'unchanged'],
		['leap', 'removed']
	]);
	expect([added.summary, removed.summary]).toEqual(['changed', 'changed']);
	trace('explorerBehavior', 'explorer-behavior-added-and-removed-states', [
		['a state that appears is added', { before: 'default', after: '+leap' }, view(added)],
		['a state that goes is removed', { before: '+leap', after: 'default' }, view(removed)]
	]);
});

test('nothing recorded on either side leaves the summary unknown with no rows', () => {
	const empty = compared(side(sha('b'), []), side(sha('a'), []));
	expect(empty).toMatchObject({ summary: 'unknown', reason: nothing, rows: [] });
	const shots = [capture()];
	const unobserved = compared(side(sha('b'), shots), side(sha('a'), shots));
	expect(unobserved, 'screenshots are not behaviour').toMatchObject({ rows: [], reason: nothing });
	trace('explorerBehavior', 'explorer-behavior-empty-selection-unknown', [
		['no captures at all', { before: [], after: [] }, view(empty)],
		['screenshots only', { before: ['screens'], after: ['screens'] }, view(unobserved)]
	]);
});

test('a rejected result, a missing record or mixed profiles leaves the summary unknown', () => {
	const failing = compared(
		side(sha('b'), [output('1', { status: 'failed' })]),
		side(sha('a'), [output('1')])
	);
	expect(failing).toMatchObject({ summary: 'unknown', reason: doubtful });
	expect(failing.rows[0]).toMatchObject({ before: null, change: 'unknown' });
	const gap = 'No verification record is attached to this commit.';
	const missing = compared(
		{ ...side(sha('b'), []), record: null, gap },
		side(sha('a'), [output('1')])
	);
	expect(missing).toMatchObject({ summary: 'unknown', reason: gap });
	const mixed = compared(side(sha('b'), [output('1')], 'p1'), side(sha('a'), [output('1')], 'p2'));
	expect(mixed).toMatchObject({
		summary: 'unknown',
		reason: 'The two sides were recorded under different profiles (p1 and p2).'
	});
	expect(changes(mixed)).toEqual([['default', 'unknown']]);
	trace('explorerBehavior', 'explorer-behavior-unusable-cell-and-gap-unknown', [
		['rejected result is unknown', { before: 'failed', after: 'passed' }, view(failing)],
		['missing record is unknown', { before: 'no record', after: 'record' }, view(missing)],
		['mixed profiles are refused', { before: 'p1', after: 'p2' }, view(mixed)]
	]);
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
	trace('explorerBehavior', 'explorer-behavior-first-commit-and-tip-not-compared', [
		['first commit gives its initial reason', { before: null }, view(first)],
		['branch tip has one side and no reason', { mode: 'current' }, view(tip)]
	]);
});

test('only output, assertions and trace are behaviour; scenario outcomes never change the summary', () => {
	const benchmark = capture({ evidence: 'bench', kind: 'benchmark', viewport: undefined });
	const after = side(sha('a'), [output('1'), capture(), benchmark], 'p1', [
		result([], { id: 'clock', status: 'failed' })
	]);
	const before = side(sha('b'), [output('1')], 'p1', [
		result([], { id: 'clock', status: 'passed' })
	]);
	const shown = compared(before, after);
	expect(shown.rows.map((row) => row.kind)).toEqual(['output']);
	expect(shown.scenarios).toEqual([
		{ id: 'clock', title: 'Clock', before: 'passed', after: 'failed' }
	]);
	expect(shown.summary).toBe('unchanged');
	expect(behaviorKinds).toEqual(['output', 'assertions', 'trace']);
	trace('explorerBehavior', 'explorer-behavior-observed-kinds-and-scenario-outcomes', [
		['benchmark and screenshot are not behaviour', { kinds: behaviorKinds }, view(shown)]
	]);
});

test('behaviorSummary gives the fixed sentences and the least certain row decides', () => {
	const [template] = compared(side(sha('b'), [output('1')]), side(sha('a'), [output('1')])).rows;
	const summarize = (...list: Row['change'][]) =>
		behaviorSummary(list.map((change): Row => ({ ...template, change })));
	const cases: Array<[string, Row['change'][], unknown]> = [
		['no rows is unknown', [], ['unknown', nothing]],
		['an unknown row decides', ['unknown', 'differs'], ['unknown', doubtful]],
		['differing bytes only differ', ['differs', 'unchanged'], ['differs', unread]],
		['all unchanged is unchanged', ['unchanged'], ['unchanged', null]],
		['an added row is changed', ['unchanged', 'added'], ['changed', null]]
	];
	for (const [, list, expected] of cases) expect(summarize(...list)).toEqual(expected);
	trace(
		'behaviorSummary',
		'behavior-summary-fixed-reasons-and-least-certain-row',
		cases.map(([name, list, expected]) => [name, { rows: list }, expected])
	);
});
