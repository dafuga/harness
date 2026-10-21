import { expect, test } from 'vitest';
import EntityVisualScreen from '../../src/components/harness/EntityVisualScreen.svelte';
import { content, disclosed, drawn, count, screen, words } from '../entityRender';
import { commits, ids } from '../entityUnits';
import { record, revision } from '../entityFixture';

const page = { category: 'pages' as const, entity: ids.page };
const card = { category: 'components' as const, entity: ids.card };

test('a page and a component open on their screenshots: a pair at a commit, one at the tip', () => {
	for (const at of [page, card]) {
		const body = screen(EntityVisualScreen, 'commit', at);
		expect(words(body), at.entity).toContain('Commit comparison');
		expect(count(body, /<img\b/g), at.entity).toBe(2);
		expect(words(body), at.entity).not.toContain('End-to-end');
		expect(drawn(body), at.entity).toBe(drawn(content('commit', at)));
		const tip = screen(EntityVisualScreen, 'current', at);
		expect(words(tip), at.entity).toContain('Current screenshot');
		expect(count(tip, /<img\b/g), at.entity).toBe(1);
	}
	expect(words(screen(EntityVisualScreen, 'commit', { ...page, tab: 'uses' }))).toMatch(
		/Uses\s+3\s+Components\s+2/
	);
});

test('the tabs of the address open what it uses and its tests on the same screen', () => {
	const related = screen(EntityVisualScreen, 'commit', { ...page, tab: 'uses' });
	expect(related).toContain('aria-label="Orders page uses"');
	expect(words(related)).toContain('OrderList');
	expect(count(related, /<img\b/g), 'relationship cards show their component screenshots').toBe(2);
	const tests = screen(EntityVisualScreen, 'commit', { ...page, tab: 'tests' });
	expect(words(tests)).toContain('States');
	expect(words(tests)).not.toContain('Verification at bbbbbbb');
	expect(disclosed(tests)).toContain('Verification at bbbbbbb');
	expect(drawn(tests)).toBe(drawn(content('commit', { ...page, tab: 'tests' })));
});

test('an entity the revision does not hold is said to be missing, with the way back', () => {
	const body = screen(EntityVisualScreen, 'commit', { category: 'pages', entity: 'app.page.gone' });
	expect(words(body)).toContain('Not at this revision');
	expect(words(body)).toContain('Nothing named app.page.gone is in the registry at bbbbbbb.');
	expect(body).toMatch(/<h1[^>]*>Not at this revision<\/h1>/);
	expect(count(body, /<img\b|role="tab"/g)).toBe(0);
});

test('a page overview keeps its declared screenshot state and viewport', () => {
	const head = revision(commits.tip, [record(commits.tip)]);
	head.registry.units = head.registry.units.map((unit) =>
		unit.id === ids.page
			? {
					...unit,
					preview: { scenario: 'orders-page', state: 'empty', viewport: 'mobile' }
				}
			: unit
	);
	const body = screen(EntityVisualScreen, 'current', page, { head });
	expect(body).toContain('/harness/media/ccccccc-empty-mobile.png');
	expect(body).not.toContain('/harness/media/ccccccc-default-desktop.png');
});
