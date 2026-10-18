import { expect, test } from 'vitest';
import EntityDetailsScreen from '../../src/components/harness/EntityDetailsScreen.svelte';
import { content, drawn, screen, words } from '../entityRender';
import { ids } from '../entityUnits';

const owned = /src\/|\+page\.svelte|\.ts\b|OrdersPage|OrderStore\b/;
const places = [
	{ category: 'pages' as const, entity: ids.page },
	{ category: 'components' as const, entity: ids.list },
	{ category: 'functions' as const, entity: ids.filter },
	{ category: 'configs' as const, entity: ids.settings },
	{ category: 'services' as const, entity: ids.store }
];

test('details of every kind open on the contract, size and performance, with no source', () => {
	for (const place of places) {
		const at = { ...place, section: 'details' as const };
		const body = screen(EntityDetailsScreen, 'commit', at);
		expect(words(body), place.entity).not.toContain('Details');
		for (const heading of ['Contract', 'Size', 'Performance profile']) {
			expect(body, place.entity).toContain(`aria-label="${heading}"`);
		}
		expect(words(body), place.entity).not.toMatch(owned);
		expect(drawn(body), place.entity).toBe(drawn(content('commit', at)));
	}
});

test('its tabs open measurements, and the source only where the source is asked for', () => {
	const at = { ...places[0], section: 'details' as const };
	const measured = screen(EntityDetailsScreen, 'commit', { ...at, tab: 'measurements' });
	expect(words(measured)).toContain('Measurements and frozen limits');
	expect(words(measured)).not.toMatch(owned);
	const source = screen(EntityDetailsScreen, 'commit', { ...at, tab: 'source' });
	expect(words(source)).toContain('src/routes/orders/+page.svelte');
});

test('details of an entity the revision does not hold say that it is missing', () => {
	const gone = { category: 'services' as const, entity: 'app.service.gone' };
	const body = screen(EntityDetailsScreen, 'commit', { ...gone, section: 'details' });
	expect(words(body)).toContain('Not at this revision');
	expect(words(body)).not.toContain('Contract and measurements');
});
