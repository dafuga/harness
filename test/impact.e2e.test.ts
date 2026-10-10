import { expect, test } from 'vitest';
import { impactRepo, serviceSource } from './support/impactRepo';
import { slugifySource } from './support/unitProject';

const allTests = [
	'test/index.test.ts',
	'test/services/clock.test.ts',
	'test/services/feed.test.ts',
	'test/services/title.test.ts',
	'test/utils/slugify.test.ts'
];

test('a shared function change selects its service, page-level consumers and scenarios only', async () => {
	const repo = await impactRepo();
	await repo.write('src/utils/slugify.ts', slugifySource.replace('"-"', '"_"'));
	const report = await repo.impact();

	expect(report.expanded).toBe(false);
	expect(report.changed).toEqual([
		{
			path: 'src/utils/slugify.ts',
			status: 'modified',
			classification: 'source',
			unit: 'function.slugify'
		}
	]);
	expect(report.units).toEqual({
		direct: ['function.slugify'],
		indirect: ['module.titles', 'service.feed', 'service.title'],
		added: [],
		removed: []
	});
	expect(report.tests.selected).toEqual([
		'test/services/feed.test.ts',
		'test/services/title.test.ts',
		'test/utils/slugify.test.ts'
	]);
	expect(report.tests.excluded).toEqual(['test/index.test.ts', 'test/services/clock.test.ts']);
	expect(report.scenarios).toEqual({ affected: ['titles'], unaffected: ['clock'] });
	expect(report.uncertain).toEqual([]);

	const head = await repo.commit('feat: change separator');
	const committed = await repo.impact(['--base', 'HEAD~1', '--head', 'HEAD']);
	expect(committed.head).toBe(head);
	expect({ ...committed, base: '', head: '' }).toEqual({ ...report, base: '', head: '' });
	expect((await repo.impact()).changed).toEqual([]);
	await repo.dispose();
}, 90_000);

test('removed units and dropped dependencies stay visible through the base graph', async () => {
	const repo = await impactRepo();
	await repo.remove('src/lib/titles.ts');
	await repo.write(
		'src/services/FeedService.ts',
		serviceSource('Feed', 'slugify', '../utils/slugify')
	);
	const report = await repo.impact();

	expect(report.changed.map((change) => [change.path, change.status])).toEqual([
		['src/lib/titles.ts', 'removed'],
		['src/services/FeedService.ts', 'modified']
	]);
	expect(report.units.removed).toEqual(['module.titles']);
	expect(report.units.direct).toEqual(['module.titles', 'service.feed']);
	expect(report.units.indirect).toEqual([]);
	expect(report.tests.selected).toEqual(['test/services/feed.test.ts']);
	expect(report.expanded).toBe(false);
	await repo.dispose();
}, 90_000);

test('a re-export change reaches consumers of the barrel and adds the new unit', async () => {
	const repo = await impactRepo();
	await repo.write('src/utils/slugifyFast.ts', slugifySource.replace('slugify(', 'slugifyFast('));
	await repo.write(
		'src/lib/titles.ts',
		"export { slugifyFast as slugify } from '../utils/slugifyFast';\n"
	);
	const report = await repo.impact();

	expect(report.units.added).toEqual(['function.slugify-fast']);
	expect(report.units.direct).toEqual(['function.slugify-fast', 'module.titles']);
	expect(report.units.indirect).toEqual(['service.feed']);
	expect(report.tests.selected).toEqual(['test/services/feed.test.ts']);
	expect(report.expanded).toBe(false);
	await repo.dispose();
}, 90_000);

test('a renamed source file keeps its unit and still selects dependents', async () => {
	const repo = await impactRepo();
	await repo.remove('src/utils/slugify.ts');
	await repo.write('src/utils/slug.ts', slugifySource);
	await repo.write(
		'src/services/TitleService.ts',
		serviceSource('Title', 'slugify', '../utils/slug')
	);
	await repo.write('src/lib/titles.ts', "export { slugify } from '../utils/slug';\n");
	await repo.write(
		'test/utils/slugify.test.ts',
		"import { slugify } from '../../src/utils/slug';\n\nexport const subject = slugify;\n"
	);
	const report = await repo.impact();

	expect(report.changed.filter((change) => change.unit === 'function.slugify')).toEqual([
		{
			path: 'src/utils/slug.ts',
			status: 'added',
			classification: 'source',
			unit: 'function.slugify'
		},
		{
			path: 'src/utils/slugify.ts',
			status: 'removed',
			classification: 'source',
			unit: 'function.slugify'
		}
	]);
	expect(report.units.added).toEqual([]);
	expect(report.units.removed).toEqual([]);
	expect(report.units.direct).toEqual(['function.slugify', 'module.titles', 'service.title']);
	expect(report.tests.selected).toEqual(allTests.filter((path) => !/index|clock/.test(path)));
	await repo.dispose();
}, 90_000);

test('a changed test selects itself and its scenario, and global config selects everything', async () => {
	const repo = await impactRepo();
	await repo.write('test/services/clock.test.ts', 'export const subject = 1;\n');
	const changedTest = await repo.impact();
	expect(changedTest.units).toEqual({ direct: [], indirect: [], added: [], removed: [] });
	expect(changedTest.tests.selected).toEqual(['test/services/clock.test.ts']);
	expect(changedTest.scenarios.affected).toEqual(['clock']);
	expect(changedTest.expanded).toBe(false);

	await repo.commit('chore: change test');
	const manifest = await repo.json<Record<string, unknown>>('package.json');
	await repo.write('package.json', JSON.stringify({ ...manifest, description: 'changed' }));
	const global = await repo.impact();
	expect(global.expanded).toBe(true);
	expect(global.tests).toEqual({ selected: allTests, excluded: [], removed: [] });
	expect(global.scenarios).toEqual({ affected: ['clock', 'titles'], unaffected: [] });
	expect(global.uncertain).toEqual([
		{ node: 'file:package.json', reason: 'global-change', detail: 'package.json' }
	]);
	await repo.dispose();
}, 90_000);
