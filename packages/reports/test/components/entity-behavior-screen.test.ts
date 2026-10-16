import { expect, test } from 'vitest';
import EntityBehaviorScreen from '../../src/components/harness/EntityBehaviorScreen.svelte';
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
	expect(words(tests)).toContain('Verification at bbbbbbb');
	const related = screen(EntityBehaviorScreen, 'commit', { ...filter, tab: 'used-in' });
	expect(related).toContain('aria-label="Filter orders used in"');
	const gone = { category: 'functions' as const, entity: 'app.function.gone' };
	expect(words(screen(EntityBehaviorScreen, 'commit', gone))).toContain('Not at this revision');
});
