import { callableUsesFixture } from '../entityPreviewCallables';
import { measureWorkload } from '../../../../test/support/measureWorkload';
import { expect, test } from 'vitest';
import EntityBehaviorScreen from '../../src/components/explorer-ui/EntityBehaviorScreen.svelte';
import { record, revision } from '../entityFixture';
import { content, drawn, count, screen, words } from '../entityRender';
import { capture, commits, ids } from '../entityUnits';

const filter = { category: 'functions' as const, entity: ids.filter };
const store = { category: 'services' as const, entity: ids.store };

test('a function and a service open on what their end-to-end checks recorded, not on pictures', () => {
	for (const at of [filter, store]) {
		const body = screen(EntityBehaviorScreen, 'commit', at);
		expect(words(body), at.entity).toContain('End-to-end test comparison');
		expect(words(body), at.entity).toContain('Before · aaaaaaa Parent commit');
		expect(count(body, /<img\b/g), at.entity).toBe(0);
		expect(drawn(body), at.entity).toBe(drawn(content('commit', at)));
		const tip = screen(EntityBehaviorScreen, 'current', at);
		expect(words(tip), at.entity).toContain('Current end-to-end behavior');
		expect(words(tip), at.entity).not.toMatch(/Before ·|Commit comparison|Current screenshot/);
	}
});

test('a clip recorded for what is run is heard under its results', () => {
	const taken = record(commits.tip);
	taken.scenarios[1].states[0].captures.push(
		capture(commits.tip, { kind: 'audio', state: 'match' })
	);
	const body = screen(EntityBehaviorScreen, 'current', filter, {
		head: revision(commits.tip, [taken])
	});
	expect(words(body)).toContain('Current audio');
	expect(count(body, /<audio\b/g)).toBe(1);
	expect(body.indexOf('Current end-to-end behavior')).toBeLessThan(body.indexOf('Current audio'));
});

test('its tabs and a missing entity behave as on every entity screen', () => {
	const tests = screen(EntityBehaviorScreen, 'commit', { ...filter, tab: 'tests' });
	expect(words(tests)).toContain('Examples');
	expect(words(tests)).not.toContain('Recorded tests and verification');
	expect(words(tests)).not.toContain('Verification at bbbbbbb');
	const related = screen(EntityBehaviorScreen, 'commit', { ...filter, tab: 'used-in' });
	expect(related).toContain('aria-label="filterOrders used in"');
	const gone = { category: 'functions' as const, entity: 'app.function.gone' };
	expect(words(screen(EntityBehaviorScreen, 'commit', gone))).toContain('Not at this revision');
});

test('selected callable Uses exclude module dependencies and hide empty navigation', async () => {
	const head = revision(commits.tip, []);
	const unit = callableUsesFixture(head.registry.units.find((item) => item.id === ids.filter)!);
	head.registry.units = head.registry.units.map((item) => (item.id === unit.id ? unit : item));
	head.registry.units.push({
		...unit,
		id: 'app.function.external',
		title: 'externalHelpers',
		helpers: [
			{
				name: 'external',
				source: 'external.ts',
				inputs: [],
				pure: true,
				consumers: [{ unit: ids.filter, symbol: 'outer' }]
			}
		]
	});
	const uses = (helper: string) =>
		content(
			'current',
			{ category: 'functions', entity: ids.filter, helper, tab: 'uses' },
			{ head }
		);
	const outer = await measureWorkload(
		'reports.function.entity-shown',
		'selected-callable-uses',
		() =>
			measureWorkload('reports.function.entity-catalog', 'private-callable-card', () =>
				uses('outer')
			)
	);
	expect(words(outer)).toContain('inner()');
	expect(words(uses('outer'))).toContain('external()');
	expect(uses('outer')).not.toContain('aria-label="Configs uses"');
	expect(uses('inner')).not.toContain('aria-label="inner uses"');
	expect(words(uses('inner'))).not.toMatch(/\bUses\b/);
	expect(words(uses('sibling'))).not.toMatch(/\bUses\b/);
});
