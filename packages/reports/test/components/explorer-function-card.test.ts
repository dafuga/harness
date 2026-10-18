import { expect, test } from 'vitest';
import ExplorerCatalogScreen from '../../src/components/harness/ExplorerCatalogScreen.svelte';
import { revision } from '../entityFixture';
import { count, screen, words } from '../entityRender';
import { commits, ids } from '../entityUnits';

test('function catalog cards stay concise and retain revision links without detail panels', () => {
	for (const mode of ['current', 'commit'] as const) {
		const body = screen(ExplorerCatalogScreen, mode, { category: 'functions' });
		const card = /<article\b.*?<\/article>/s.exec(body)![0];
		expect(count(body, /<article\b/g)).toBe(1);
		expect(count(body, /<img\b/g)).toBe(0);
		expect(words(body)).toContain('Filter orders');
		expect(words(body)).toContain('Returns the orders whose name matches a search.');
		expect(words(card)).not.toMatch(/Contract|Inputs|Output|Used by|View tests|Shared|Changed/);
		expect(count(body, /class="hx-verdict/g)).toBe(0);
		expect(body).toContain('aria-label="Open function"');
		const commit = mode === 'current' ? '' : `/commit/${commits.middle}`;
		expect(body).toContain(`/branch/feature%2Forders${commit}/functions/${ids.filter}`);
		expect(body).not.toContain('tab=tests');
		expect(words(body)).not.toMatch(/src\/|filterOrders|\.ts\b/);
	}
});

test.each(['A'.repeat(80), 'A'.repeat(81), 'Find matching orders. '.repeat(12), '🧪'.repeat(81)])(
	'function catalog descriptions have at most 80 characters: %s',
	(description) => {
		const head = revision(commits.tip, []);
		head.registry = {
			...head.registry,
			units: head.registry.units.map((unit) =>
				unit.id === ids.filter ? { ...unit, responsibility: description } : unit
			)
		};
		const body = screen(ExplorerCatalogScreen, 'current', { category: 'functions' }, { head });
		const summary = /<p class="ex-soft[^>]*>(.*?)<\/p>/s.exec(body)![1].replace(/<!--.*?-->/gs, '');
		expect([...summary].length).toBeLessThanOrEqual(80);
		expect(summary.endsWith('…')).toBe([...description].length > 80);
		expect(description.startsWith(summary.replace(/…$/, ''))).toBe(true);
	}
);
