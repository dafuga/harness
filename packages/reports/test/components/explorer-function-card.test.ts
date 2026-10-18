import { expect, test } from 'vitest';
import ExplorerCatalogScreen from '../../src/components/harness/ExplorerCatalogScreen.svelte';
import { count, screen, words } from '../entityRender';
import { commits, ids } from '../entityUnits';

test('function catalog cards describe contracts, retain revision links and leave images to visual units', () => {
	for (const mode of ['current', 'commit'] as const) {
		const body = screen(ExplorerCatalogScreen, mode, { category: 'functions' });
		expect(count(body, /<article\b/g)).toBe(1);
		expect(count(body, /<img\b/g)).toBe(0);
		expect(words(body)).toContain('Filter orders');
		expect(words(body)).toContain('Inputs');
		expect(words(body)).toContain('Output');
		expect(body).toContain('aria-label="Open function"');
		const commit = mode === 'current' ? '' : `/commit/${commits.middle}`;
		expect(body).toContain(`/branch/feature%2Forders${commit}/functions/${ids.filter}`);
		expect(body).toContain('tab=tests');
		expect(words(body)).not.toMatch(/src\/|filterOrders|\.ts\b/);
	}
});
