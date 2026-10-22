import { expect, test } from 'vitest';
import EntityConfigScreen from '../../src/components/harness/EntityConfigScreen.svelte';
import { content, drawn, count, screen, words } from '../entityRender';
import { ids } from '../entityUnits';

const settings = { category: 'configs' as const, entity: ids.settings };

test('a config opens on what it provides and who uses it, with no picture, run or clip', () => {
	const body = screen(EntityConfigScreen, 'current', settings);
	expect(words(body)).toContain('Current configuration');
	expect(words(body)).toContain('Used In');
	expect(body).not.toMatch(/aria-label="(?:Used In|Uses)"/);
	expect(count(body, /<img\b|<audio\b/g)).toBe(0);
	expect(words(body)).not.toMatch(/End-to-end|Current screenshot|Current audio/);
	expect(drawn(body)).toBe(drawn(content('current', settings)));
	expect(screen(EntityConfigScreen, 'commit', settings)).toContain('Values at');
});

test('its tabs and a missing config behave as on every entity screen', () => {
	const related = screen(EntityConfigScreen, 'commit', { ...settings, tab: 'used-in' });
	expect(related).toContain('aria-label="orderSettings used in"');
	expect(words(related)).toContain('Orders page');
	const tests = screen(EntityConfigScreen, 'commit', { ...settings, tab: 'tests' });
	expect(words(tests)).toContain('Verification at bbbbbbb');
	const gone = { category: 'configs' as const, entity: 'app.config.gone' };
	expect(words(screen(EntityConfigScreen, 'commit', gone))).toContain('Not at this revision');
});
