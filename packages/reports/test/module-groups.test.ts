import { measureWorkload } from '../../../test/support/measureWorkload';
import { helperEntity } from '../src/utils/explorer-ui/entityShown';
import { categorySources, projectPageSources } from './entityPreviewGroups';
import { expect, test } from 'vitest';
import { entityCatalog, catalogFilter } from '../src/utils/entityCatalog';
import { explorerEntities } from '../src/utils/explorer-ui/explorerEntities';
import { explorerRelations } from '../src/utils/explorer-ui/explorerRelations';
import { record, revision } from './entityFixture';
import { commits, ids } from './entityUnits';

const head = revision(commits.middle, [record(commits.middle)]);
const entities = explorerEntities(head).map((entity) => ({
	...entity,
	unit: {
		...entity.unit,
		group:
			entity.id === ids.search
				? { id: 'inputs', title: 'Inputs' }
				: { id: 'orders', title: 'Orders' }
	}
}));
const rows = (category: Parameters<typeof entityCatalog>[1]) =>
	entityCatalog(entities, category, (id) => explorerRelations(head, id));
const filter = { search: '', changedOnly: false, order: 'name' as const };

test('catalog categories survive across kinds and combine with other filters', () => {
	for (const category of ['pages', 'components', 'functions', 'services', 'configs'] as const) {
		expect(rows(category)[0]).toHaveProperty('group', { id: 'orders', title: 'Orders' });
	}
	const components = rows('components');
	const selected = { ...filter, groups: ['inputs'] };
	expect(catalogFilter(components, selected).map((row) => row.name)).toEqual(['SearchBox']);
	expect(catalogFilter(components, { ...selected, search: 'card' })).toEqual([]);
	expect(catalogFilter(components, { ...selected, changedOnly: true })).toEqual([]);
	expect(catalogFilter(components, { ...filter, groups: ['orders', 'inputs'] })).toHaveLength(3);
	expect(catalogFilter(components, { ...filter, groups: ['missing'] })).toEqual([]);
	expect(catalogFilter(components, { ...filter, groups: [] })).toHaveLength(3);
	expect(catalogFilter(components, { ...filter, search: 'Inputs' }).map((row) => row.name)).toEqual(
		['SearchBox']
	);
	const project = projectPageSources(head);
	const pages = entityCatalog(explorerEntities(project), 'pages', (id) =>
		explorerRelations(project, id)
	);
	expect(pages.map((row) => row.group?.id)).not.toContain('explorer-ui');
	expect(pages.map((row) => row.id)).not.toContain('reports.page.harness-view');
	for (const [feature, title, count] of [
		['components', 'Components', 3],
		['configs', 'Configs', 3],
		['functions', 'Helpers', 3],
		['layouts', 'Layouts', 3],
		['models', 'Models', 3],
		['pages', 'Pages', 3],
		['services', 'Services', 3],
		['platforms', 'Platforms', 2],
		['styles', 'Styles', 1],
		['types', 'Types', 3]
	] as const) {
		const family = pages.filter((row) =>
			row.entity.unit.owns.source.some((path) => path.includes(`/[...at]/${feature}/`))
		);
		expect(family, `${title} includes its registered page roles`).toHaveLength(count);
		for (const row of family)
			expect(row, 'Page families follow their feature folders').toHaveProperty('group', {
				id: `${feature === 'functions' ? 'helper' : feature.replace(/s$/, '')}-catalog`,
				title
			});
	}
});

test('a helper row uses its callable folder instead of its owning module category', async () => {
	const grouped = categorySources(head);
	const items = explorerEntities(grouped);
	const rows = await measureWorkload(
		'reports.function.entity-catalog',
		'helper-source-folders',
		() => entityCatalog(items, 'functions', (id) => explorerRelations(grouped, id))
	);
	const selected = await measureWorkload(
		'reports.function.entity-shown',
		'helper-source-breadcrumb',
		() => helperEntity(rows.find((row) => row.name === 'plural')?.entity, 'plural')
	);
	expect(selected?.unit).toHaveProperty('group', { id: 'strings', title: 'Strings' });
	expect(rows.find((row) => row.name === 'plural')).toHaveProperty('group', {
		id: 'strings',
		title: 'Strings'
	});
	expect(rows.find((row) => row.name === 'filterOrders')).toHaveProperty('group', {
		id: 'orders',
		title: 'Orders'
	});
});

const transforms = [
	[
		'reports.function.entity-contract',
		async () => (await import('../src/utils/explorer-ui/entityContract')).humanize,
		'humanize',
		['HTTPStatus'],
		'http status'
	],
	[
		'reports.function.entity-lens',
		async () => (await import('../src/utils/explorer-ui/entityLens')).shortCommit,
		'shortCommit',
		['0123456789'],
		'0123456'
	],
	[
		'reports.function.activity-display',
		async () => (await import('../src/utils/projects-sessions/activityDisplay')).plural,
		'plural',
		[2, 'item'],
		'2 items'
	],
	[
		'reports.function.evidence-media',
		async () => (await import('../src/utils/verification-evidence/evidenceMedia')).formatDuration,
		'formatDuration',
		[90.9],
		'1:30'
	]
] as const;
test.each(
	transforms.map(([unit, entry, name, args, output]) => ({ unit, entry, name, args, output }))
)(
	'Strings relocation preserves public entry $name',
	async ({ unit, entry, name, args, output }) => {
		const legacy = await entry();
		const canonical = await import(`../src/helpers/strings/${name}.ts`);
		expect(legacy).toBe(canonical[name]);
		await measureWorkload(
			unit,
			`strings-${name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())}`,
			() => expect(canonical[name](...args)).toBe(output)
		);
	}
);
