import { expect, test } from 'vitest';
import { record, revision } from '../entityFixture';
import { content, words } from '../entityRender';
import { commits, ids } from '../entityUnits';

const page = { category: 'pages' as const, entity: ids.page, section: 'details' as const };
const owned = /src\/|\+page\.svelte|\.ts\b|OrdersPage|OrderStore\b/;
const tabs = (body: string) =>
	[...body.matchAll(/role="tab"[^>]*>(.*?)<\/(?:a|button)>/gs)].map((match) =>
		words(match[1]).trim()
	);

test('details opens on the contract with size and performance, and shows no source', () => {
	const body = content('commit', page);
	expect(tabs(body)).toEqual(['Contract', 'Measurements', 'Source', 'History']);
	expect(words(body)).toContain('Contract and measurements');
	for (const heading of ['Contract', 'Size', 'Performance profile']) {
		expect(body).toContain(`aria-label="${heading}"`);
	}
	expect(words(body)).toContain('Back to overview');
	expect(words(body)).not.toMatch(owned);
	expect(words(body)).not.toMatch(/Source ownership|provenance/i);
});

test('a page has details like every other kind: purpose, address, inputs, output and states', () => {
	const body = content('current', page);
	expect(words(body)).toContain('Purpose Lists the orders of an account.');
	expect(words(body)).toContain('App route /orders');
	expect(words(body)).toContain('Inputs account id, search text');
	expect(words(body)).toContain('Required states default, empty');
	expect(words(body)).toContain('Source size Not measured');
	// Back to the overview keeps the branch tip; nothing adds a commit to the address.
	expect(body).toContain(`href="/harness/branch/feature%2Forders/pages/${ids.page}"`);
	expect(body).not.toContain('/commit/');
});

test('source is shown only when the source tab is the open one', () => {
	const closed = ['measurements', undefined] as const;
	for (const tab of closed) {
		expect(words(content('commit', { ...page, tab }))).not.toMatch(owned);
	}
	const body = content('commit', { ...page, tab: 'source' });
	expect(words(body)).toContain('Source ownership');
	expect(words(body)).toContain('src/routes/orders/+page.svelte');
	expect(body).toContain(`/commit/${commits.middle}/pages/${ids.page}/details?tab=source`);
});

test('measurements name the limit each figure is frozen at, or that none is recorded', () => {
	const body = content('commit', {
		category: 'functions',
		entity: ids.filter,
		section: 'details',
		tab: 'measurements'
	});
	expect(words(body)).toContain('Measurements and frozen limits');
	expect(words(body)).toContain('source bytes 800 bytes');
	expect(words(body)).toContain('complexity not measured at this revision');
	expect(words(body)).toContain('at most 5% worse than its baseline');
	expect(words(body)).not.toMatch(owned);
});

test('a service has each execution target on a line of its own, never added together', () => {
	const body = content('commit', { category: 'services', entity: ids.store, section: 'details' });
	expect(words(body)).toContain('Runs as Module, Wasm, Native process');
	expect(words(body)).toContain('Emitted size · Wasm 18 KB');
	expect(words(body)).toContain('Emitted size · process (native) Not measured');
	expect(words(body)).toContain('no toolchain');
});

test('a recorded note that names a file is shown without it on measurements and on the contract', () => {
	const noted = record(commits.middle);
	noted.measurements = noted.measurements.map((item) =>
		item.unit === ids.store && item.value === null
			? { ...item, unavailable: 'the build of crates/kernel/src/lib.rs produced no output' }
			: item
	);
	const store = { category: 'services' as const, entity: ids.store, section: 'details' as const };
	const head = revision(commits.middle, [noted]);
	for (const tab of ['measurements', undefined] as const) {
		const body = content('commit', { ...store, tab }, { head });
		expect(words(body)).toContain('the build of a file produced no output');
		expect(words(body)).not.toMatch(/crates\/|lib\.rs/);
	}
});

test('a declared contract explains each item on the details, and stays names on the overview', () => {
	const head = revision(commits.middle, [record(commits.middle)]);
	const told = {
		inputs: [{ name: 'branch', type: 'string', description: 'The branch, as one path segment.' }],
		outputs: [{ name: '+page', type: 'markup', description: 'The page with its verdict.' }],
		errors: [{ name: 'not-at-revision', type: 'notice', description: 'A missing page is said.' }]
	};
	const units = head.registry.units.map((unit) =>
		unit.id === ids.page ? { ...unit, contract: told } : unit
	);
	head.registry = { ...head.registry, units };
	const details = content('commit', page, { head });
	expect(words(details)).toContain('Inputs branch branch The branch, as one path segment.');
	expect(words(details)).toContain('rendered markup The page with its verdict.');
	expect(words(details)).toContain(
		'Fails with not at revision not at revision A missing page is said.'
	);
	const overview = content('commit', { category: 'pages', entity: ids.page }, { head });
	expect(words(overview)).toContain(
		'Inputs branch Output rendered markup Fails with not at revision'
	);
	expect(words(overview)).not.toContain('The branch, as one path segment.');
});
