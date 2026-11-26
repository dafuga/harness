import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { ExplorerEntity, ExplorerLocation } from '../../src/models/explorer-ui/Explorer.types';
import {
	compactHelperLocation,
	correctedLocation
} from '../../src/utils/development-tooling/correctedLocation';
import type { Cases } from './reports.function.corrected-location.test.types';
const unitId = 'reports.function.corrected-location';
const record = (symbol: string, state: string, cases: Cases) =>
	recordExampleCases(
		{ unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		cases
	);
const sha = (character: string) => character.repeat(40);
const listed = (id: string, category: string) =>
	({ id, category }) as Pick<ExplorerEntity, 'id' | 'category'>;
const owner = (id: string, helpers: string[]) =>
	({
		id,
		category: 'functions',
		unit: { helpers: helpers.map((name) => ({ name })) }
	}) as unknown as ExplorerEntity;

const shell = 'desktop.component.workspace-shell';
const shellAt: ExplorerLocation = {
	branch: 'feat/x',
	commit: sha('a'),
	category: 'components',
	entity: shell,
	section: 'details',
	tab: 'source'
};
const route: ExplorerLocation = {
	branch: 'feat/x',
	commit: null,
	category: 'functions',
	helper: 'formatDuration',
	tab: 'examples'
};
const duration = owner('function.duration', ['formatDuration']);
const another = owner('function.other-duration', ['formatDuration']);

test('A shell addressed under Components is led to its listed category with the rest of the address kept', () => {
	const tip = { ...shellAt, commit: null, section: undefined, tab: undefined };
	const outputs = [
		correctedLocation(shellAt, [listed(shell, 'layouts')]),
		correctedLocation(tip, [listed(shell, 'layouts')])
	];
	expect(outputs).toEqual([
		{ ...shellAt, category: 'layouts' },
		{ ...tip, category: 'layouts' }
	]);
	record('correctedLocation', 'shell-category-corrected', [
		{ name: 'shell at a commit, listed as a layout', input: shellAt, output: outputs[0] },
		{ name: 'shell at the branch tip, listed as a layout', input: tip, output: outputs[1] }
	]);
});

test('A helper address gains its owner only when exactly one listed function unit owns the name', () => {
	const sole = correctedLocation(route, [duration]);
	const none = correctedLocation(route, []);
	const several = correctedLocation(route, [duration, another]);
	const pinned = { ...route, commit: sha('b') };
	const atOther = correctedLocation(pinned, [another]);
	expect(sole).toEqual({ ...route, entity: duration.id });
	expect(none).toBeNull();
	expect(several).toBeNull();
	expect(atOther).toEqual({ ...pinned, entity: another.id });
	record('correctedLocation', 'helper-owner-added-only-for-sole-owner', [
		{ name: 'one listed owner of the helper', input: route, output: sole },
		{ name: 'no listed owner of the helper', input: route, output: none },
		{ name: 'two listed owners of the helper', input: route, output: several },
		{ name: 'sole owner at a commit', input: pinned, output: atOther }
	]);
});

test('Platforms, absent entities and correctly categorized addresses get no correction', () => {
	const platform = { ...shellAt, category: 'platforms' as const };
	const absent = { ...shellAt, entity: 'desktop.component.removed' };
	const multiHelper = { ...route, entity: duration.id };
	const cases = [
		{
			name: 'platforms address',
			input: platform,
			output: correctedLocation(platform, [listed(shell, 'components')])
		},
		{
			name: 'entity absent from the revision',
			input: absent,
			output: correctedLocation(absent, [listed(shell, 'layouts')])
		},
		{
			name: 'entity already under its listed category',
			input: shellAt,
			output: correctedLocation(shellAt, [listed(shell, 'components')])
		},
		{
			name: 'helper with an entity already set, though two owners exist',
			input: multiHelper,
			output: correctedLocation(multiHelper, [duration, another])
		}
	];
	expect(cases.map((item) => item.output)).toEqual([null, null, null, null]);
	record('correctedLocation', 'platforms-absent-and-correct-addresses-stay-null', cases);
});

test('Compaction drops the entity only when it is the sole current owner of the helper', () => {
	const current = { ...route, entity: duration.id };
	const compacted = compactHelperLocation(current, [duration]);
	expect(compacted).toEqual(route);
	expect(compacted).not.toHaveProperty('entity');
	record('compactHelperLocation', 'compact-drops-only-the-sole-current-owner', [
		{
			name: 'entity is the sole listed owner of the helper',
			input: current,
			output: compacted
		}
	]);
});

test('Compaction returns ambiguous, foreign, incomplete and non-function addresses unchanged', () => {
	const current = { ...route, entity: duration.id };
	const foreign = { ...route, entity: another.id };
	const noHelper = { ...current, helper: undefined };
	const component = { ...current, category: 'components' as const };
	const noEntity = { ...route };
	const cases = [
		{
			name: 'two owners of the helper',
			input: current,
			output: compactHelperLocation(current, [duration, another])
		},
		{
			name: 'current entity is not the sole owner',
			input: foreign,
			output: compactHelperLocation(foreign, [duration])
		},
		{
			name: 'no entity to compact',
			input: noEntity,
			output: compactHelperLocation(noEntity, [duration])
		},
		{
			name: 'address without a helper',
			input: noHelper,
			output: compactHelperLocation(noHelper, [duration])
		},
		{
			name: 'address in the components category',
			input: component,
			output: compactHelperLocation(component, [duration])
		}
	];
	expect(cases.map((item) => item.output)).toEqual(cases.map((item) => item.input));
	record('compactHelperLocation', 'compact-keeps-ambiguous-and-foreign-addresses', cases);
});
