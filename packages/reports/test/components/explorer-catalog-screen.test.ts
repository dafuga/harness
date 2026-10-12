import { expect, test } from 'vitest';
import ExplorerCatalogScreen from '../../src/components/harness/ExplorerCatalogScreen.svelte';
import { revision } from '../entityFixture';
import { content, drawn, count, screen, words } from '../entityRender';
import { commits } from '../entityUnits';

const kinds = {
	components: ['Components', 'Order card'],
	functions: ['Functions', 'Filter orders'],
	configs: ['Configs', 'Order settings'],
	services: ['Services', 'Order store']
} as const;

test('every other collection is a table of its own kind, never cards', () => {
	for (const [category, [title, name]] of Object.entries(kinds)) {
		const at = { category: category as keyof typeof kinds };
		const body = screen(ExplorerCatalogScreen, 'commit', at);
		expect(body, category).toContain(`<table class="ex-table" aria-label="${title}"`);
		expect(words(body), category).toContain(name);
		expect(count(body, /<article\b/g), category).toBe(0);
		expect(drawn(body), category).toBe(drawn(content('commit', at)));
	}
});

test('a collection of a revision without a registry shows its gap and no table', () => {
	const bare = revision(commits.middle, []);
	bare.registry = { ...bare.registry, available: false };
	const body = screen(ExplorerCatalogScreen, 'commit', { category: 'services' }, { head: bare });
	expect(words(body)).toContain('No registry at this revision');
	expect(count(body, /<table\b/g)).toBe(0);
});
