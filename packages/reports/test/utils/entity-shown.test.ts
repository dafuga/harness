import { expect, test } from 'vitest';
import { entityShown } from '../../src/utils/entityShown';
import { record, revision } from '../entityFixture';
import { hostProps } from '../entityRender';
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

test('an entity the commit removed keeps the states its parent required of it', () => {
	const head = revision(commits.middle, [record(commits.middle)]);
	const kept = scenarios.map((scenario) => ({ ...scenario, states: [] }));
	head.registry = { ...head.registry, scenarios: kept };
	const host = hostProps('commit', { category: 'pages', entity: ids.page }, { head });
	const page = host.entities.find((item) => item.id === ids.page)!;
	// At the commit the page has no state left; removed, its last contract is the parent's.
	expect(value(entityShown(host, page).contract, 'Required states')).toBe('None declared');
	const removed = { ...page, change: 'removed' as const, lastAt: commits.first };
	expect(value(entityShown(host, removed).contract, 'Required states')).toBe('default, empty');
});
