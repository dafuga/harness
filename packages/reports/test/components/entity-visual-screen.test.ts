import { expect, test } from 'vitest';
import EntityVisualScreen from '../../src/components/harness/EntityVisualScreen.svelte';
import { content, drawn, count, screen, words } from '../entityRender';
import { ids } from '../entityUnits';

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
	expect(words(screen(EntityVisualScreen, 'commit', page))).toMatch(/Uses\s+3\s+Components\s+2/);
});

test('the tabs of the address open what it uses and its tests on the same screen', () => {
	const related = screen(EntityVisualScreen, 'commit', { ...page, tab: 'uses' });
	expect(related).toContain('aria-label="Orders page uses"');
	expect(words(related)).toContain('Order list');
	expect(count(related, /<img\b/g)).toBe(0);
	const tests = screen(EntityVisualScreen, 'commit', { ...page, tab: 'tests' });
	expect(words(tests)).toContain('Verification at bbbbbbb');
	expect(drawn(tests)).toBe(drawn(content('commit', { ...page, tab: 'tests' })));
});

test('an entity the revision does not hold is said to be missing, with the way back', () => {
	const body = screen(EntityVisualScreen, 'commit', { category: 'pages', entity: 'app.page.gone' });
	expect(words(body)).toContain('Not at this revision');
	expect(words(body)).toContain('Nothing named app.page.gone is in the registry at bbbbbbb.');
	expect(body).toMatch(/<h1[^>]*>Not at this revision<\/h1>/);
	expect(count(body, /<img\b|role="tab"/g)).toBe(0);
});
