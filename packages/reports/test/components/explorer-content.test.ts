import { expect, test } from 'vitest';
import { record, revision } from '../entityFixture';
import { content, count, verdicts, words } from '../entityRender';
import { commits, ids } from '../entityUnits';

const source = /src\/|\+page\.svelte|\.ts\b|OrdersPage|filterOrders/;
const banned = /sub-?components|\brelated\b|\breports?\b|dashboard|analytics/i;

test('the pages collection is cards with a page title and screenshot without a proof legend', () => {
	const body = content('current');
	expect(words(body)).toContain('Pages Start with the pages people use.');
	expect(body).toContain('aria-label="Orders page"');
	// The tip shows the tip's capture, and the link stays on the branch without a commit.
	expect(body).toContain('src="/harness/media/ccccccc-default-desktop.png"');
	expect(body).toContain('href="/harness/branch/feature%2Forders/pages/app.page.orders"');
	expect(words(body)).not.toContain('2 components');
	// Catalogs omit proof marks and their legend; evidence belongs to the entity view.
	expect(verdicts(body)).toEqual([]);
	expect(body).not.toContain('class="ex-legend"');
	expect(words(body)).not.toContain('Hover, focus or tap a mark to read why.');
	expect(words(body)).not.toContain('Full coverage passed');
	expect(words(body)).not.toMatch(source);
	expect(words(body)).not.toMatch(banned);
});

test('configs keep columns; component, helper and service collections use cards', () => {
	const headers = (body: string) =>
		[...body.matchAll(/<th scope="col">(.*?)<\/th>/gs)].map((match) => words(match[1]).trim());
	const expected = {
		configs: ['Variable', 'Value']
	};
	for (const [category, columns] of Object.entries(expected)) {
		const body = content('commit', { category: category as keyof typeof expected });
		expect(headers(body)).toEqual(columns);
		expect(words(body)).not.toMatch(source);
		expect(words(body)).not.toMatch(banned);
	}
	const components = content('commit', { category: 'components' });
	expect(count(components, /<article\b/g)).toBe(3);
	expect(count(components, /<img\b/g)).toBe(3);
	expect(words(components)).not.toMatch(source);
	expect(words(components)).not.toMatch(banned);
	expect(words(components)).toContain('OrderList');
	expect(words(components)).toContain('Orders page');
	// A link from a selected commit stays at that commit.
	expect(components).toContain(`/commit/${commits.middle}/components/${ids.list}`);
	const functions = content('commit', { category: 'functions' });
	expect(count(functions, /<article\b/g)).toBe(1);
	expect(count(functions, /<img\b/g)).toBe(0);
	// Function symbols now appear in usage calls; source paths and component symbols stay hidden.
	expect(words(functions)).not.toMatch(/src\/|\+page\.svelte|\.ts\b|OrdersPage/);
	expect(words(functions)).toContain('filterOrders(orders, "SERVICE")');
	expect(words(functions)).not.toMatch(banned);
	const services = content('commit', { category: 'services' });
	expect(count(services, /<article\b/g)).toBe(1);
	expect(headers(services)).toEqual([]);
	expect(words(services)).toContain('OrderStore');
	expect(services).toContain(`/commit/${commits.middle}/services/${ids.store}`);
	expect(words(services)).not.toMatch(/src\/|\.ts\b|Execution target|Responsibility|Consumers/);
});

test('a collection offers search, changed only and an order, and says how many it lists', () => {
	const body = content('commit', { category: 'functions' });
	expect(body).toContain('aria-label="Search helpers"');
	expect(body).not.toContain('aria-label="Filters"');
	expect(words(body)).not.toContain('Changed only');
	expect(body).not.toMatch(/<select[^>]*aria-label="Order"/);
	expect(words(body)).toContain('1 of 1 helpers shown');
});

test('verification is a check or a cross with its reason, and never a share', () => {
	const partial = revision(commits.middle, [record(commits.middle, false)]);
	const body = content('commit', { category: 'pages', entity: ids.page }, { head: partial });
	const [badge] = verdicts(body);
	expect(badge).toEqual({
		passed: false,
		name: 'Coverage incomplete',
		reasons: ['Orders page over synthetic orders: empty has no result in the record.']
	});
	// The status and its reason are told by the tooltip; the row itself stays the icon.
	expect(words(body)).not.toMatch(/Coverage incomplete|has no result in the record/);
	expect(words(body)).not.toMatch(/\d+\s?%|amber|partial(ly)?/i);
	expect(body).not.toMatch(/class="[^"]*\b(warning|amber)\b/);
});

test('an entity the revision does not hold is said to be missing, and nothing replaces it', () => {
	const body = content('commit', { category: 'functions', entity: 'app.function.gone' });
	expect(words(body)).toContain('Not at this revision');
	expect(words(body)).toContain('Nothing from another revision is shown in its place.');
	expect(body).toContain(
		`href="/harness/branch/feature%2Forders/commit/${commits.middle}/functions"`
	);
	expect(count(body, /<img/g)).toBe(0);
});

test('a revision without a registry shows its gap and no collection of another revision', () => {
	const bare = revision(commits.middle, []);
	bare.registry = { ...bare.registry, available: false, gap: 'The registry could not be read' };
	const body = content('commit', {}, { head: bare });
	expect(words(body)).toContain('No registry at this revision');
	expect(words(body)).toContain('The registry could not be read.');
	expect(words(body)).not.toContain('Orders page');
});
