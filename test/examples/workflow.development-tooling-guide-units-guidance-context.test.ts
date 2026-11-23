import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import {
	guidanceText,
	guidanceUnit,
	headlessOnly,
	headlessStateNames,
	namedUnitStates,
	scenarioStatesFor,
	sourceUnitStates
} from '../../src/workflows/development-tooling/guide-units/guidanceContext';
import {
	unitId,
	scenarioFixture,
	prefix,
	fakeContext,
	unitManifest,
	thrownBy,
	sourcePath,
	multi,
	readyRegistry
} from './workflow.development-tooling-guide-units-guidance-context.fixtures';

function meta(symbol: string, state: string) {
	return { unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

const uiState = scenarioFixture('ui', [unitId], [{ id: `${prefix}-ui`, coverage: 'required' }]);

test('Finds the active unit and rejects unknown ids', () => {
	const context = fakeContext({
		stored: [unitManifest(), unitManifest('retired', 'workflow.old')]
	});
	const found = guidanceUnit(context, unitId);
	const retired = thrownBy(() => guidanceUnit(context, 'workflow.old'));
	const wrongCase = thrownBy(() => guidanceUnit(context, unitId.toUpperCase()));

	expect(found.id).toBe(unitId);
	expect(retired.message).toBe('Unknown unit "workflow.old".');
	expect(wrongCase.message).toContain('Unknown unit');
	recordExampleCases(meta('guidanceUnit', 'finds-the-active-unit-and-rejects-unknown-ids'), [
		{
			name: 'active id returns the stored manifest',
			input: { id: unitId },
			output: { id: found.id, status: found.status }
		},
		{ name: 'retired id is not found', input: { id: 'workflow.old' }, error: retired },
		{ name: 'upper-case id is not found', input: { id: unitId.toUpperCase() }, error: wrongCase }
	]);
});

test('Reads each path once and serves later calls from the cache', async () => {
	const reads: string[] = [];
	const text = 'export const value = 1;\n';
	const context = fakeContext({ texts: { [sourcePath]: text }, reads });
	const first = await guidanceText(context, sourcePath);
	const second = await guidanceText(context, sourcePath);

	expect(first).toBe(text);
	expect(second).toBe(text);
	expect(reads).toEqual([sourcePath]);
	recordExampleCases(
		meta('guidanceText', 'reads-each-path-once-and-serves-later-calls-from-the-cache'),
		[
			{
				name: 'first read goes to the tree',
				input: { path: sourcePath },
				output: { text: first, treeReads: 1 }
			},
			{
				name: 'second read is served from context.texts',
				input: { path: sourcePath },
				output: { text: second, treeReads: reads.length }
			}
		]
	);
});

test('Keeps only the scenario states attributed to one unit', () => {
	const single = scenarioFixture('ui', [unitId], [{ id: 'any-label', coverage: 'required' }]);
	const attributed = scenarioStatesFor(multi, unitId).map((state) => state.id);
	const other = scenarioStatesFor(multi, 'workflow.other').map((state) => state.id);
	const unrelated = scenarioStatesFor(multi, 'workflow.unrelated').map((state) => state.id);
	const singleUnit = scenarioStatesFor(single, unitId).map((state) => state.id);

	expect(attributed).toEqual([`${prefix}-ready`]);
	expect(other).toEqual(['workflow-other-ready']);
	expect(unrelated).toEqual([]);
	expect(singleUnit).toEqual(['any-label']);
	recordExampleCases(
		meta('scenarioStatesFor', 'keeps-only-the-scenario-states-attributed-to-one-unit'),
		[
			{
				name: 'multi-unit scenario keeps only this unit state',
				input: { unitId },
				output: attributed
			},
			{
				name: 'related unit keeps its own prefixed state',
				input: { unitId: 'workflow.other' },
				output: other
			},
			{
				name: 'unit outside scenario.units gets nothing',
				input: { unitId: 'workflow.unrelated' },
				output: unrelated
			},
			{
				name: 'single-unit scenario keeps any non-inapplicable state',
				input: { unitId },
				output: singleUnit
			}
		]
	);
});

test('Lists headless states that no registry declares', () => {
	const headless = headlessStateNames([multi], unitId, []);
	const declared = headlessStateNames([multi], unitId, [readyRegistry]);
	const headlessAlone = headlessOnly([multi], unitId);
	const withUi = headlessOnly([multi, uiState], unitId);

	expect(headless).toEqual(['ready']);
	expect(declared).toEqual([]);
	expect(headlessAlone).toBe(true);
	expect(withUi).toBe(false);
	recordExampleCases(
		meta('headlessStateNames', 'lists-headless-states-that-no-registry-declares'),
		[
			{
				name: 'undeclared required headless state is listed',
				input: { registryStates: [] },
				output: headless
			},
			{
				name: 'registry-declared state is suppressed',
				input: { registryStates: ['ready'] },
				output: declared
			},
			{
				name: 'headless-only unit has no attributed UI state',
				input: { scenarios: 1 },
				output: headlessAlone
			},
			{
				name: 'attributed UI state makes unit not headless-only',
				input: { scenarios: 2 },
				output: withUi
			}
		]
	);
});

test('Merges registry and scenario states with the default state', () => {
	const context = fakeContext({
		scenarios: [multi],
		registries: [{ ...readyRegistry, states: ['loading', 'ready'] }]
	});
	const states = namedUnitStates(context, unitManifest());
	const names = states.map((state) => state.name).sort();

	expect(names).toEqual(['default', 'loading', 'ready']);
	expect(states.every((state) => state.origin === 'REQUIRED')).toBe(true);
	recordExampleCases(
		meta('namedUnitStates', 'merges-registry-and-scenario-states-with-the-default-state'),
		[
			{
				name: 'registry and scenario ready merge by name with default',
				input: { unitId },
				output: names
			}
		]
	);
});

test('Guesses states from source branch literals', async () => {
	const source =
		"export type Props = { status: 'idle' | 'complete' };\nif (state === 'active') render();\n";
	const context = fakeContext({ texts: { [sourcePath]: source } });
	const states = await sourceUnitStates(context, unitManifest());
	const summary = states
		.map((state) => ({ name: state.name, origin: state.origin }))
		.sort((a, b) => a.name.localeCompare(b.name));

	expect(summary.map((state) => state.name)).toEqual(['active', 'complete', 'idle', 'succeeded']);
	expect(states.every((state) => state.origin === 'GUESS')).toBe(true);
	recordExampleCases(meta('sourceUnitStates', 'guesses-states-from-source-branch-literals'), [
		{
			name: 'status, state and complete literals in one source file',
			input: { path: sourcePath },
			output: summary
		}
	]);
});
