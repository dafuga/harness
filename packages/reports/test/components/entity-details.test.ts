import { expect, test } from 'vitest';
import { index, record, revision } from '../entityFixture';
import { content, words } from '../entityRender';
import { commits, ids } from '../entityUnits';
import { withGroups } from '../entityPreviewData';
import { sourceAdmissionArrays } from '../entitySourceFixture';
import { explorerEntities } from '../../src/utils/explorerEntities';
import { render } from 'svelte/server';
import EntitySource, { archivedSource } from '../../src/components/explorer-ui/EntitySource.svelte';
import type { HarnessUnit } from '../../src/models/Harness.types';

const page = { category: 'pages' as const, entity: ids.page, section: 'details' as const };
const owned = /src\/|\+page\.svelte|\.ts\b|OrdersPage|OrderStore\b/;
const tabs = (body: string) =>
	[...body.matchAll(/role="tab"[^>]*>(.*?)<\/(?:a|button)>/gs)].map((match) =>
		words(match[1]).trim()
	);

test('details opens on the contract with size and performance, and shows no source', () => {
	const body = content('commit', page);
	expect(tabs(body)).toEqual(['Overview', 'Models', 'Uses', 'States', 'History', 'Source']);
	expect(words(body)).toContain('Lists the orders of an account.');
	for (const heading of ['Contract', 'Performance profile']) {
		expect(body).toContain(`aria-label="${heading}"`);
	}
	expect(body).not.toContain('aria-label="Size"');
	expect(words(body)).toContain('Source size');
	expect(words(body)).not.toContain('Emitted size');
	expect(words(body)).not.toContain('This unit declares no process or Wasm output.');
	expect(words(body)).not.toContain('Back to overview');
	expect(words(body)).not.toContain('Details');
	expect(words(body)).not.toMatch(owned);
	expect(words(body)).not.toMatch(/Source ownership|provenance/i);
});

test('a page contract shows purpose, address, inputs and output without verification states', () => {
	const body = content('current', page);
	expect(words(body)).toContain('Purpose Lists the orders of an account.');
	expect(words(body)).toContain('App route /orders');
	expect(words(body)).toContain('Inputs');
	for (const input of ['account id', 'search text'])
		expect(words(body)).toMatch(new RegExp(`\\b${input}\\b`, 'i'));
	expect(words(body)).not.toContain('Required states default, empty');
	expect(words(body)).toContain('Source size Not measured');
	// Back to the overview keeps the branch tip; nothing adds a commit to the address.
	expect(body).toContain(`href="/harness/branch/feature%2Forders/pages/${ids.page}"`);
	expect(body).not.toContain('/commit/');
});

test('source is shown only when the source tab is the open one', async () => {
	for (const tab of ['measurements', undefined] as const)
		expect(words(content('commit', { ...page, tab }))).not.toMatch(owned);
	for (const mode of ['current', 'commit'] as const) {
		const body = content(mode, { ...page, tab: 'source' });
		const commit = mode === 'current' ? commits.tip : commits.middle;
		expect(body, 'GitHub source links use the selected commit').toContain(
			`href="https://github.com/example/orders/blob/${commit}/src/routes/orders/%2Bpage.svelte"`
		);
		expect(words(body)).not.toMatch(/Symbols|Execution targets|Identity /);
	}
	for (const sourceRepository of [
		undefined,
		'javascript:alert(1)',
		'https://github.com.evil/repo'
	]) {
		const body = content('commit', { ...page, tab: 'source' }, {}, { ...index, sourceRepository });
		expect(words(body)).toContain('GitHub source unavailable');
		expect(body).not.toContain('href="https://github.com/');
	}
	const body = content('commit', { ...page, tab: 'source' });
	expect(words(body)).toContain('Source files');
	expect(words(body)).toContain('src/routes/orders/+page.svelte');
	expect(body).toContain(`/commit/${commits.middle}/pages/${ids.page}?tab=source`);
	const head = withGroups(revision(commits.middle, []));
	await sourceAdmission(head.registry.units.find((unit) => unit.id === ids.store)!);
	for (const entity of explorerEntities(head)) {
		const { helper, files } = sourceSelection(entity);
		const source = content(
			'commit',
			{
				category: entity.category,
				entity: entity.id,
				tab: 'source',
				helper
			},
			{ head }
		);
		const section = /<section[^>]*aria-labelledby="ex-source-title"[^>]*>(.*?)<\/section>/s.exec(
			source
		)![1];
		expect(words(section)).not.toMatch(/Symbols|Execution targets|Identity .*version/);

		expect(
			[...section.matchAll(/<li\b[^>]*>(.*?)<\/li>/gs)].map((match) =>
				words(/<(?:a|code)\b[^>]*>(.*?)<\/(?:a|code)>/s.exec(match[1])?.[1] ?? match[1]).trim()
			)
		).toEqual(
			files.map((path) =>
				entity.category === 'services' ? path.replace(/^src\/services\//, '') : path
			)
		);
		expect((section.match(/aria-label="View code for /g) ?? []).length).toBe(files.length);
	}
});

/** Choose a callable implementation or the selected revision's category sources. */
function sourceSelection(entity: ReturnType<typeof explorerEntities>[number]) {
	if (entity.category === 'functions') {
		const helper = entity.unit.helpers![0];
		return { helper: helper.name, files: [helper.source] };
	}
	const grouped = entity.unit.owns.source.filter((path) =>
		path.includes(`/${entity.unit.group!.id}/`)
	);
	return { helper: undefined, files: grouped.length ? grouped : entity.unit.owns.source };
}

/** Source accepts indexed arrays before serialization without invoking custom iteration/species. */
async function sourceAdmission(unit: HarnessUnit): Promise<void> {
	const { paths, tests, snapshots, reads } = sourceAdmissionArrays(unit);
	const body = render(EntitySource, {
		props: { unit: { ...unit, owns: { ...unit.owns, source: paths }, testFiles: tests } }
	}).body;
	expect(words(body)).toContain('orders/OrderStore.ts');
	expect(body).toContain('title="src/services/orders/OrderStore.ts"');
	expect(words(body)).toContain('test/order-store.test.ts');
	const beforeRead = reads.indexed;
	const reader = archivedSource({ ...unit, sourceFiles: snapshots, testFiles: tests }, '/media/');
	expect(reads.indexed, 'source readers keep indexed getters lazy until a read').toBe(beforeRead);
	await expect(
		reader.read(paths[0]),
		'indexed source snapshots retain their recorded gap'
	).rejects.toThrow('Recorded implementation gap');
	await expect(reader.read(tests[0].path)).rejects.toThrow('Recorded test gap');
	expect(reads.indexed).toBeGreaterThan(0);
	expect(reads.iterated).toBe(0);
	expect(reads.species).toBe(0);
}

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

test('a declared contract explains each item in its dedicated tab and details', () => {
	const head = revision(commits.middle, [record(commits.middle)]);
	const told = {
		inputs: [{ name: 'branch', type: 'string', description: 'The branch, as one path segment.' }],
		outputs: [{ name: '+page', type: 'markup', description: 'The page with its verdict.' }],
		errors: [{ name: 'not-at-revision', type: 'notice', description: 'A missing page is said.' }]
	};
	const units = head.registry.units.map((unit) =>
		unit.id === ids.settings ? { ...unit, contract: told } : unit
	);
	head.registry = { ...head.registry, units };
	const details = content(
		'commit',
		{ category: 'configs', entity: ids.settings, section: 'details' },
		{ head }
	);
	const contract = content(
		'commit',
		{ category: 'configs', entity: ids.settings, tab: 'contract' },
		{ head }
	);
	for (const body of [details, contract]) {
		for (const type of ['string', 'markup', 'notice']) expect(words(body)).toContain(type);
		expect(body).toContain('View example for Branch');
		expect(words(body)).toContain('Example not recorded');
		expect(words(body)).not.toContain('The branch, as one path segment.');
		expect(words(body)).not.toContain('The page with its verdict.');
		expect(words(body)).not.toContain('A missing page is said.');
	}
});
