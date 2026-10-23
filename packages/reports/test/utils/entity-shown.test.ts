import { expect, test } from 'vitest';
import { entityShown } from '../../src/components/explorer-ui/entity-sections/entityShown';
import { record, revision } from '../entityFixture';
import { hostProps } from '../entityRender';
import { withFocused } from '../entityStates';
import { commits, ids, scenarios } from '../entityUnits';

const value = (rows: Array<{ label: string; value: string }>, label: string) =>
	rows.find((row) => row.label === label)?.value;

test('the summary of an entity is its contract, its measures and the record that judges it', () => {
	const host = hostProps('commit', { category: 'functions', entity: ids.filter });
	const entity = host.entities.find((item) => item.id === ids.filter)!;
	const shown = entityShown(host, entity);
	expect(value(shown.contract, 'Inputs')).toBe('orders, search text');
	expect(value(shown.measure.size, 'Source size')).toBe('800 B');
	expect(shown.record?.id).toBe('rec-bbbbbb-0000');
});

const tree = 'd'.repeat(40);
test.each([
	{ name: 'original commit', commit: commits.middle, expected: true },
	{
		name: 'identical prepared tree',
		commit: commits.tip,
		side: `sides/${tree}.json`,
		expected: true
	},
	{ name: 'identical projected tree', commit: commits.tip, sourceTree: tree, expected: true },
	{ name: 'changed tree', commit: commits.tip, sourceTree: 'e'.repeat(40), expected: false },
	{ name: 'unknown tree', commit: commits.tip, expected: false }
])(
	'focused measurements retain their provenance at the $name',
	({ expected, name: _, ...source }) => {
		const focused = withFocused(revision(commits.middle, []));
		const measurement = {
			unit: ids.page,
			metric: 'browser-navigation-ms',
			unitOfMeasure: 'ms',
			value: 12.5,
			workload: 'orders-page-desktop',
			profile: 'chromium',
			target: 'http' as const,
			testedRevision: commits.middle,
			artifacts: [],
			method: 'Chromium navigation duration of the original focused capture.'
		};
		const point = {
			...focused.regressions![0].green!,
			sourceTree: tree,
			measurements: [measurement]
		};
		const head = {
			...focused,
			...source,
			regressions: [{ ...focused.regressions![0], green: point }]
		};
		const original = JSON.stringify(head);
		const host = hostProps('commit', { category: 'pages', entity: ids.page }, { head });
		const page = host.entities.find((item) => item.id === ids.page)!;
		const shown = entityShown(host, page);
		expect(shown.measure.performance.map((row) => row.value)).toEqual(expected ? ['12.5 ms'] : []);
		expect(shown.record, 'focused observations never grant a full verification verdict').toBeNull();
		expect(point.measurements[0].testedRevision).toBe(commits.middle);
		expect(JSON.stringify(head), 'reading a sibling squash must not relabel its measurements').toBe(
			original
		);
	}
);

test('a removed entity does not mix parent verification states into its last contract', () => {
	const head = revision(commits.middle, [record(commits.middle)]);
	const kept = scenarios.map((scenario) => ({ ...scenario, states: [] }));
	head.registry = { ...head.registry, scenarios: kept };
	const host = hostProps('commit', { category: 'pages', entity: ids.page }, { head });
	const page = host.entities.find((item) => item.id === ids.page)!;
	// State coverage belongs to verification and never appears among contract fields.
	expect(value(entityShown(host, page).contract, 'Required states')).toBeUndefined();
	const removed = { ...page, change: 'removed' as const, lastAt: commits.first };
	expect(value(entityShown(host, removed).contract, 'Required states')).toBeUndefined();
});
