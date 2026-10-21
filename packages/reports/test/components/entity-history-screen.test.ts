import { expect, test } from 'vitest';
import EntityHistoryScreen from '../../src/components/harness/EntityHistoryScreen.svelte';
import { content, drawn, screen, words } from '../entityRender';
import { ids } from '../entityUnits';

const hashes = (body: string) =>
	[...body.matchAll(/class="ex-hash"[^>]*>(?:<!--.*?-->)*(\w+)</g)].map((match) => match[1]);

test('the history screen lists the commits that changed the entity, for every kind', () => {
	const filter = {
		category: 'functions' as const,
		entity: ids.filter,
		section: 'history' as const
	};
	const body = screen(EntityHistoryScreen, 'commit', filter);
	expect(hashes(body)).toEqual(['bbbbbbb', 'aaaaaaa']);
	expect(words(body), 'Compact commit history').not.toContain('Selected change');
	expect(drawn(body)).toBe(drawn(content('commit', filter)));
	const page = { category: 'pages' as const, entity: ids.page, section: 'history' as const };
	expect(hashes(screen(EntityHistoryScreen, 'commit', page))).toEqual(['aaaaaaa']);
});

test('the history of an entity the revision does not hold says that it is missing', () => {
	const gone = { category: 'components' as const, entity: 'app.component.gone' };
	const body = screen(EntityHistoryScreen, 'commit', { ...gone, section: 'history' });
	expect(words(body)).toContain('Not at this revision');
	expect(hashes(body)).toEqual([]);
});
