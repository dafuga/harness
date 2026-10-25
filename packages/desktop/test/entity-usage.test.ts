import type { Direction } from './entity-usage.test.types';
import { expect, test } from 'vitest';
import RelationshipsPanel from '../src/components/RelationshipsPanel.svelte';
import type { Workspace } from '../src/lib/stores/workspace.svelte';
import type { Category, Relationship } from '../src/models/Desktop.types';
import { categories } from '../src/models/Desktop.types';
import { workspaceRoute } from '../src/utils/workspaceRoute';
import { drawn } from './evidence-fixture';
const link = (direction: Direction, id: string, title: string, category: Category | null) =>
	({ id, title, category, direction, hasPlan: false, verification: 'unknown' }) as Relationship;
/** A function used by a page and, recorded twice, by a component; it uses three things. */
const related = [
	link('used-by', 'app.page.orders', 'OrdersPage', 'pages'),
	link('used-by', 'app.component.order-list', 'OrderList', 'components'),
	link('used-by', 'app.component.order-list', 'OrderList', 'components'),
	link('uses', 'app.service.order-store', 'OrderStore', 'services'),
	link('uses', 'app.config.order-settings', 'orderSettings', 'configs'),
	link('uses', 'app.model.order', 'Order', null)
];
const workspace = {
	path: (category: string, id: string) => `/harness/${category}/${id}`,
	navigate: async () => {}
} as unknown as Workspace;
const words = (body: string) =>
	body
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
const panel = (direction: Direction, relationships = related) =>
	words(drawn(RelationshipsPanel, { relationships, workspace, direction }));
const times = (text: string, part: string) => text.split(part).length - 1;

test('Used In lists what uses the entity once each, with what it is', () => {
	const used = panel('used-by');
	expect(used).toMatch(/^Used In 2 /);
	expect(used).toMatch(/Orders page\s+Page\b/);
	expect(used).toMatch(/OrderList\s+Component\b/);
	expect(times(used, 'OrderList')).toBe(1);
	expect(used).not.toMatch(/relationship|Used by|Uses|OrderStore|orderSettings|src\//i);
	expect(used, 'usage lists omit verification marks').not.toMatch(/[×✓]/);
	for (const category of categories) {
		const singular =
			category === 'apis' ? 'API' : category[0].toUpperCase() + category.slice(1, -1);
		expect(
			panel('used-by', [link('used-by', `app.${singular}.consumer`, 'Consumer', category)]),
			`${category} uses its canonical singular label`
		).toMatch(new RegExp(`\\b${singular}$`));
	}
});

test('Uses keeps what the entity depends on apart by kind, with what is none of the five last', () => {
	const uses = panel('uses');
	expect(uses).toMatch(/^Uses 3 .*Configs 1 orderSettings.*Services 1 OrderStore.*Other 1 Order\b/);
	expect(uses).not.toMatch(/relationship|Used by|Used In|Orders page|OrderList|src\//i);
	expect(uses, 'usage lists omit verification marks').not.toMatch(/[×✓]/);
	const body = drawn(RelationshipsPanel, { relationships: related, workspace, direction: 'uses' });
	expect(body).toContain('href="/harness/services/app.service.order-store"');
	expect(body).not.toContain('app.model.order"');
});

test('an entity with nothing recorded says so in each section', () => {
	expect(panel('used-by', [])).toBe('Used In 0 Nothing recorded uses it.');
	expect(panel('uses', [])).toBe('Uses 0 No dependency is recorded.');
});

test('each section has an address, and the former one is still read', () => {
	const at = (suffix: string) =>
		workspaceRoute(`/harness/branch/main/functions/app.function.filter-orders/${suffix}`).suffix;
	expect([at('used-in'), at('uses'), at('relationships')]).toEqual([
		'used-in',
		'uses',
		'relationships'
	]);
});
