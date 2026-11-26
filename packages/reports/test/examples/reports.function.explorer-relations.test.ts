import { test } from 'vitest';
import { explorerEntities } from '../../src/utils/explorer-ui/explorerEntities';
import {
	explorerRelations,
	explorerRelationsReader
} from '../../src/utils/explorer-ui/explorerRelations';
import { record, revision } from '../entityFixture';
import { commits, ids, units } from '../entityUnits';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type { Unit, Relations } from './reports.function.explorer-relations.test.types';

const head = revision(commits.middle, [record(commits.middle)]);
const card = units.find((unit) => unit.id === ids.card)!;

/** A revision with extra units appended; the shared fixture stays unchanged. */
const withUnits = (extra: Unit[]) => ({
	...head,
	registry: { ...head.registry, units: [...head.registry.units, ...extra] }
});

/** The ids of each section, so a result is compared by identity and order. */
const idsOf = (list: Array<{ id: string }> = []) => list.map((item) => item.id);
const shape = (relations: Relations) =>
	Object.fromEntries(Object.entries(relations).map(([key, list]) => [key, idsOf(list)]));

/** Records one named symbol's cases as a trace of their inputs and results. */
function traceCases(
	symbol: string,
	state: string,
	list: Array<[name: string, input: unknown, output: unknown]>
): boolean {
	const cases = list.map(([name, input, output]) => ({ name, input, output }));
	return recordExampleCases(
		{
			unitId: 'reports.function.explorer-relations',
			symbol,
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		cases
	);
}

const usesState = 'explorer-relations-uses-and-owners';
test('a page lists the categorized units it uses and a leaf lists the pages that show it', () => {
	const page = shape(explorerRelations(head, ids.page));
	const leaf = shape(explorerRelations(head, ids.filter));
	const store = shape(explorerRelations(head, ids.store));
	expect(page.components).toEqual([ids.list, ids.search]);
	expect(page.configs).toEqual([ids.settings]);
	expect(page.functions, 'a unit used only by a component is not listed by the page').toEqual([]);
	expect(page.pages).toEqual([]);
	expect(leaf.pages).toEqual([ids.page]);
	expect(leaf.usedBy).toEqual([ids.list]);
	expect(store.usedBy).toEqual([ids.list, ids.search]);
	expect(store.pages, 'pages are found upward through every user').toEqual([ids.page]);
	traceCases('explorerRelations', usesState, [
		['page uses components and configs', { id: ids.page }, page],
		['function used by a component', { id: ids.filter }, leaf],
		['service shared by two components', { id: ids.store }, store]
	]);
});

const scopeState = 'explorer-relations-scope-and-absent-rows';
test('removed units and absent ids give no relation rows', () => {
	const retired: Unit = { ...card, id: 'app.component.retired', status: 'removed' };
	const retiredUser: Unit = {
		...card,
		id: 'app.component.retired-user',
		status: 'removed',
		dependencies: [{ unit: ids.card, via: 'import' }]
	};
	const scoped = withUnits([retired, retiredUser]);
	const found = {
		retiredUsers: shape(explorerRelations(scoped, ids.card)).usedBy,
		removedId: shape(explorerRelations(scoped, retired.id)),
		unknownId: shape(explorerRelations(head, 'app.component.missing')),
		empty: shape(explorerRelations(head, ''))
	};
	expect(found.retiredUsers, 'a removed unit is not a user').toEqual([ids.list]);
	expect(found.removedId, 'a removed unit has no relations').toEqual(
		shape(explorerRelations(head, 'app.component.missing'))
	);
	expect(Object.values(found.unknownId).flat()).toEqual([]);
	expect(Object.values(found.empty).flat()).toEqual([]);
	traceCases('explorerRelations', scopeState, [
		['removed user is absent', { id: ids.card }, found.retiredUsers],
		['removed id has no rows', { id: retired.id }, found.removedId],
		['unknown id has no rows', { id: 'app.component.missing' }, found.unknownId],
		['empty id has no rows', { id: '' }, found.empty]
	]);
});

const readerState = 'explorer-relations-reader-reuses-built-entities';
test('the reader keeps each answer and reuses only entities built for this unit', () => {
	const built = explorerEntities(head);
	const reader = explorerRelationsReader(head, built);
	const first = reader(ids.page);
	expect(reader(ids.page), 'asking again gives the same object').toBe(first);
	const fresh = explorerRelations(head, ids.page);
	expect(shape(first), 'the reader agrees with a one-shot read').toEqual(shape(fresh));
	const listed = built.find((entity) => entity.id === ids.list)!;
	expect(first.components?.find((item) => item.id === ids.list)).toBe(listed);
	const stale = { ...listed, lastAt: commits.first };
	const again = explorerRelationsReader(head, [stale])(ids.page);
	expect(again.components?.find((item) => item.id === ids.list)).not.toBe(stale);
	traceCases('explorerRelationsReader', readerState, [
		['same id gives same answer', { id: ids.page }, shape(first)],
		['built entity handed out as is', { id: ids.page, built: ids.list }, shape(first).components],
		[
			'stale parent entity worked out again',
			{ id: ids.page, lastAt: commits.first },
			shape(again).components
		]
	]);
});
