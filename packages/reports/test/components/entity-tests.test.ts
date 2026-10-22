import { expect, test } from 'vitest';
import { record, revision } from '../entityFixture';
import { content, count, disclosed, verdicts, words, verificationPanel } from '../entityRender';
import { commits, ids, scenarios } from '../entityUnits';

const page = { category: 'pages' as const, entity: ids.page, tab: 'tests' as const };
const names = (body: string) => verdicts(body).map((badge) => badge.name);
/** The row of one state in the table of a scenario. */
const row = (body: string, state: string) => {
	const rows = body.split(/(?=<tr\b)/).map((part) => part.split('</tr>')[0]);
	return rows.find((part) => part.includes(`<th scope="row">${state}</th>`)) ?? '';
};
const missing = 'No capture of Orders page over synthetic orders: empty at mobile.';
type Kind = 'pages' | 'functions' | 'services' | 'configs';
/** The evidence labels read on an entity screen opened at its former Tests address. */
const labels = (category: Kind, entity: string) => {
	const shown = words(content('commit', { category, entity, tab: 'tests' }));
	return shown.match(/\b(?:Examples|States|Tests)\b/g) ?? [];
};

test('tests show the verdict, each scenario with its states, and the checks that ran', () => {
	const body = content('commit', page);
	expect(disclosed(body)).toContain('Verification at bbbbbbb');
	expect(names(body)).toContain('Full coverage passed');
	expect(names(body)).toContain('Every required state is proven');
	// A badge is its icon: what it says is its name and its tooltip, not words on the page.
	expect(words(body)).not.toMatch(/Full coverage passed|Every required state is proven/);
	expect(disclosed(body)).toContain('Orders page over synthetic orders');
	expect(words(row(body, 'default'))).toContain('default required');
	expect(verdicts(row(body, 'default'))).toEqual([{ passed: true, name: 'Proven', reasons: [] }]);
	// A state the scenario says does not apply keeps its declared reason and has no badge.
	expect(words(row(body, 'denied'))).toContain(
		'denied inapplicable: the orders page has no sign-in Not applicable'
	);
	expect(verdicts(row(body, 'denied'))).toEqual([]);
	expect(disclosed(body)).toContain('orders-browser passed e2e · 900 ms');
	expect(words(body)).not.toMatch(/src\/|\.ts\b/);
});

test('the reasons a verdict failed are listed where a person looks for them', () => {
	const partial = revision(commits.middle, [record(commits.middle, false)]);
	const body = content('commit', page, { head: partial });
	const why = 'Orders page over synthetic orders: empty has no result in the record.';
	expect(verdicts(body)[0]).toEqual({ passed: false, name: 'Coverage incomplete', reasons: [why] });
	expect(body).toContain('aria-label="Why it is not proven"');
	expect(verdicts(row(body, 'default'))).toEqual([{ passed: true, name: 'Proven', reasons: [] }]);
	expect(verdicts(row(body, 'empty'))).toEqual([
		{ passed: false, name: 'Coverage incomplete', reasons: [why] }
	]);
	// The missing evidence is also read on the page, once for the state and not again per slot.
	expect(count(words(row(body, 'empty')), /has no result in the record/g)).toBe(1);
	expect(words(body)).not.toMatch(/\d+\s?%/);
});

test('one capture of a state that needs two viewports is a cross on that state, not a check', () => {
	const partial = record(commits.middle);
	const empty = partial.scenarios[0].states.find((state) => state.id === 'empty')!;
	empty.captures = empty.captures.filter((item) => item.viewport === 'desktop');
	const body = content('commit', page, { head: revision(commits.middle, [partial]) });
	expect(verdicts(row(body, 'empty'))).toEqual([
		{ passed: false, name: 'Coverage incomplete', reasons: [missing] }
	]);
	expect(words(row(body, 'empty')).trim()).toBe(`empty required ${missing}`);
	expect(verdicts(row(body, 'default'))[0].passed).toBe(true);
	expect(names(body)).not.toContain('Every required state is proven');
	expect(names(body)).not.toContain('Full coverage passed');
});

test('the full comparison is the existing gallery, which pairs each capture with its before', () => {
	const body = content('commit', page);
	expect(disclosed(body)).toContain('Screenshot gallery');
	// Four states and viewports: each after is listed once, its before is opened beside it.
	expect(disclosed(body)).toContain('4 / 4');
	for (const file of ['bbbbbbb-default-desktop.png', 'bbbbbbb-empty-mobile.png']) {
		expect(body).toContain(`/harness/media/${file}`);
	}
	expect(disclosed(body)).toContain('Fresh capture');
	expect(body).not.toContain('ccccccc');
});

test('a function lists its end-to-end results in full, and a revision without a record says so', () => {
	const filter = { category: 'functions' as const, entity: ids.filter, tab: 'tests' as const };
	expect(words(verificationPanel('commit', filter))).toContain('End-to-end test comparison');
	const bare = verificationPanel('current', filter, { head: revision(commits.tip, []) });
	expect(words(bare)).toContain('No usable verification record judges this revision.');
	expect(words(bare)).toContain('No verification record is attached to this commit.');
	expect(words(bare)).toContain('filter-flow not in the record');
	expect(verdicts(bare).every((badge) => !badge.passed)).toBe(true);
	expect(new Set(names(bare))).toEqual(new Set(['Evidence missing', 'not in the record']));
});

test('what the commit no longer declares is shown as gone, with a result before and none after', () => {
	const head = revision(commits.middle, [record(commits.middle, false)]);
	const kept = scenarios.map((scenario) => ({
		...scenario,
		states: scenario.states.filter((state) => state.id !== 'empty')
	}));
	head.registry = { ...head.registry, scenarios: kept };
	const body = content('commit', page, { head });
	expect(disclosed(body)).toContain('No longer declared at bbbbbbb');
	expect(disclosed(body)).toContain('Orders page over synthetic orders: the state empty.');
	expect(words(content('commit', page))).not.toContain('No longer declared');
});

test('services and functions say Examples, visual entities States and other kinds Tests', () => {
	for (const [category, entity] of [
		['services', ids.store],
		['functions', ids.filter]
	] as const) {
		expect(labels(category, entity)).toContain('Examples');
		expect(labels(category, entity)).not.toContain('Tests');
	}
	expect(labels('pages', ids.page)).toContain('States');
	expect(labels('pages', ids.page)).not.toContain('Tests');
	expect(labels('configs', ids.settings)).toContain('Tests');
	expect(labels('configs', ids.settings)).not.toContain('Examples');
});
