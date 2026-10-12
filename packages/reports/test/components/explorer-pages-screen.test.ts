import { expect, test } from 'vitest';
import ExplorerPagesScreen from '../../src/components/harness/ExplorerPagesScreen.svelte';
import { revision } from '../entityFixture';
import { content, drawn, count, screen, words } from '../entityRender';
import { commits } from '../entityUnits';

test('the pages screen lists pages as cards, each with its own screenshot and a real link', () => {
	const body = screen(ExplorerPagesScreen, 'current');
	expect(words(body)).toContain('Pages Start with the pages people use.');
	expect(count(body, /<article\b[^>]*aria-label="Orders page"/g)).toBe(1);
	expect(body).toContain('src="/harness/media/ccccccc-default-desktop.png"');
	expect(body).toContain('href="/harness/branch/feature%2Forders/pages/app.page.orders"');
	// Pages are never a table, and the screen is the one the content shows at this address.
	expect(count(body, /<table\b/g)).toBe(0);
	expect(drawn(body)).toBe(drawn(content('current')));
});

test('a revision without a registry is said to have none, and no page of another is listed', () => {
	const bare = revision(commits.middle, []);
	bare.registry = { ...bare.registry, available: false, gap: 'The registry could not be read' };
	const body = screen(ExplorerPagesScreen, 'commit', {}, { head: bare });
	expect(words(body)).toContain('No registry at this revision');
	expect(words(body)).toContain('The registry could not be read.');
	expect(count(body, /<article\b/g)).toBe(0);
});
