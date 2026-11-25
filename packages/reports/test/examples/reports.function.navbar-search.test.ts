import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { navbarSearch as navbarSearchComponent } from '../../src/components/explorer-ui/harness-navbar/navbarSearch';
import { navbarSearch } from '../../src/utils/explorer-ui/navbarSearch';
import type { SearchEntry } from '../../src/utils/explorer-ui/entitySearch';
import { sha, shellBranch, shellScope } from '../../tests/e2e/support/shellData';
import type { Cases } from './reports.function.navbar-search.test.types';
const unitId = 'reports.function.navbar-search';
const record = (state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol: 'navbarSearch', state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);

const entry = (
	commit: string,
	id = 'app.shell.order-frame',
	category: SearchEntry['category'] = 'layouts'
): SearchEntry => ({ id, category, name: 'Order frame', purpose: '', terms: [], commit });
const tip = shellScope({ branch: shellBranch, commit: null, category: 'pages' });
const pinned = shellScope({ branch: shellBranch, commit: sha(3), category: 'functions' });
const retained = shellScope({ branch: null, commit: sha(9), category: 'pages' });
/** A tip scope whose branch is gone: the label falls back to the retained commits. */
const floating = { ...tip, branch: null, location: { ...tip.location, branch: null } };

/** What the search offers, says and leads to for the probed entries, as plain values. */
function observe(
	scope: Parameters<typeof navbarSearch>[0],
	given: Parameters<typeof navbarSearch>[1],
	probes: SearchEntry[]
) {
	const search = navbarSearch(scope, given);
	return {
		entries: search.entries,
		scope: search.scope,
		at: probes.map((probe) => search.at(probe))
	};
}

test('Missing scope or unavailable entries read nothing and offer nothing', () => {
	const cases = [
		{ name: 'no scope, no entries', input: { scope: null, given: null } },
		{ name: 'no scope, empty set', input: { scope: null, given: [] } },
		{ name: 'tip, entries undefined', input: { scope: 'tip', given: undefined } }
	];
	const outputs = [
		observe(null, null, [entry(sha(5))]),
		observe(null, [], [entry(sha(5))]),
		observe(tip, undefined, [entry(sha(5))])
	];
	expect(outputs[0]).toEqual({
		entries: null,
		scope: { label: 'Reading the history', pinned: null },
		at: [null]
	});
	expect(outputs[1].entries).toBeNull();
	expect(outputs[2]).toEqual({
		entries: null,
		scope: { label: `At the tip of ${shellBranch}`, pinned: null },
		at: [null]
	});
	record(
		'scope-and-entries-missing-read-nothing',
		cases.map((item, index) => ({ ...item, output: outputs[index] }))
	);
});

test('The tip offers the entries of its commit and leads each held result to the tip', () => {
	const held = [entry(sha(5))];
	const search = observe(tip, held, [entry(sha(5)), entry(sha(5), 'app.shell.other', 'functions')]);
	expect(search.entries).toEqual(held);
	expect(search.at).toEqual([
		{ branch: shellBranch, commit: null, category: 'layouts', entity: 'app.shell.order-frame' },
		null
	]);
	const empty = observe(tip, [], [entry(sha(5))]);
	expect(empty).toMatchObject({ entries: [], at: [null] });
	const component = navbarSearchComponent(tip, held);
	expect({ entries: component.entries, scope: component.scope }).toEqual({
		entries: search.entries,
		scope: search.scope
	});
	record('tip-offers-entries-of-the-shown-commit', [
		{ name: 'held result at the tip', input: { given: held }, output: search },
		{ name: 'empty set at the tip', input: { given: [] }, output: empty }
	]);
});

test('A pinned commit is labelled by its short sha and leads to that commit', () => {
	const search = observe(pinned, [entry(sha(3))], [entry(sha(3))]);
	expect(search.scope).toEqual({
		label: `At commit ${sha(3).slice(0, 7)}`,
		pinned: sha(3).slice(0, 7)
	});
	expect(search.at).toEqual([
		{ branch: shellBranch, commit: sha(3), category: 'layouts', entity: 'app.shell.order-frame' }
	]);
	record('pinned-commit-shows-short-sha', [
		{ name: 'pinned commit with a held result', input: { scope: pinned.commit }, output: search }
	]);
});

test('One entry of another commit rejects the whole set', () => {
	const mixed = [entry(sha(3)), entry(sha(5), 'app.shell.side-frame')];
	const search = observe(pinned, mixed, [entry(sha(3))]);
	expect(search.entries).toBeNull();
	expect(search.at).toEqual([null]);
	record('one-foreign-commit-rejects-whole-set', [
		{ name: 'one mismatch in two entries', input: { given: mixed }, output: search }
	]);
});

test('Unavailable entries are not offered at a pinned commit', () => {
	const absent = observe(pinned, null, [entry(sha(3))]);
	const undef = observe(pinned, undefined, [entry(sha(3))]);
	expect(absent).toMatchObject({ entries: null, at: [null] });
	expect(undef).toMatchObject({ entries: null, at: [null] });
	record('unavailable-entries-are-not-offered', [
		{ name: 'null entries', input: { given: null }, output: absent },
		{ name: 'undefined entries', input: { given: undefined }, output: undef }
	]);
});

test('A commit no branch keeps is labelled by commit, and a branchless tip by the retained commits', () => {
	const kept = observe(retained, [entry(sha(9))], [entry(sha(9))]);
	const floatingTip = observe(floating, [entry(sha(5))], [entry(sha(5))]);
	expect(kept.scope).toEqual({
		label: `At commit ${sha(9).slice(0, 7)}`,
		pinned: sha(9).slice(0, 7)
	});
	expect(kept.at).toEqual([
		{ branch: null, commit: sha(9), category: 'layouts', entity: 'app.shell.order-frame' }
	]);
	expect(floatingTip.scope).toEqual({ label: 'At the tip of the retained commits', pinned: null });
	expect(floatingTip.at).toEqual([
		{ branch: null, commit: null, category: 'layouts', entity: 'app.shell.order-frame' }
	]);
	record('retained-commit-without-branch', [
		{ name: 'retained commit with no branch', input: { scope: 'retained' }, output: kept },
		{ name: 'branchless tip', input: { scope: 'floating tip' }, output: floatingTip }
	]);
});

test('A result is followed only when its commit, category and id are all held', () => {
	const probes = [
		entry(sha(3), 'app.shell.order-frame', 'functions'),
		entry(sha(3), 'app.shell.other-frame'),
		entry(sha(5))
	];
	const search = observe(pinned, [entry(sha(3))], probes);
	expect(search.at).toEqual([null, null, null]);
	const held = observe(pinned, [entry(sha(3))], [entry(sha(3))]);
	expect(held.at[0]).not.toBeNull();
	record('at-follows-only-held-key', [
		{ name: 'same commit, other category', input: { probe: probes[0] }, output: search.at[0] },
		{ name: 'same commit, other id', input: { probe: probes[1] }, output: search.at[1] },
		{ name: 'other commit', input: { probe: probes[2] }, output: search.at[2] },
		{ name: 'held key', input: { probe: entry(sha(3)) }, output: held.at[0] }
	]);
});
