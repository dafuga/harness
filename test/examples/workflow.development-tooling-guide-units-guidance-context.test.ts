import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { guidanceText, guidanceUnit, headlessOnly, headlessStateNames, namedUnitStates, scenarioStatesFor, sourceUnitStates } from '../../src/workflows/development-tooling/guide-units/guidanceContext';
import type { ComponentManifest, ScenarioManifest } from '../../src/core/development-tooling/unitTypes';
import type { GuidanceContext, StateRegistry } from '../../src/workflows/development-tooling/guide-units/guideUnits.types';

const unitId = 'workflow.development-tooling-guide-units-guidance-context';
const prefix = 'workflow-development-tooling-guide-units-guidance-context';
const sourcePath = 'src/workflows/development-tooling/guide-units/guidanceContext.ts';

function meta(symbol: string, state: string) {
	return { unitId, symbol, state, evidence: 'examples-cases', file: `${state}.json` };
}

function unitManifest(status = 'active', id = unitId): ComponentManifest {
	return {
		schemaVersion: 1,
		id,
		uid: 'u_bfad3bg4oz',
		kind: 'workflow',
		title: 'guidanceContext',
		responsibility: 'Example responsibility.',
		responsibilityOrigin: 'declared',
		status,
		owns: { source: [sourcePath], symbols: ['guidanceContext'] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [], errorStatus: 'declared' },
		dependencies: [],
		runtime: { kind: 'module', entry: sourcePath, targets: [] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	} as unknown as ComponentManifest;
}

function scenarioFixture(
	kind: 'headless' | 'ui',
	units: string[],
	states: { id: string; coverage: string; units?: string[] }[]
): ScenarioManifest {
	const viewports = kind === 'ui' ? [{ id: 'desktop', width: 1280, height: 800 }] : [];
	const id = `guide-units.${kind}`;
	return { schemaVersion: 1, id, title: 'Fixture', kind, units, states, viewports, tests: [], evidence: [] } as unknown as ScenarioManifest;
}

function fakeContext(input: {
	stored?: ComponentManifest[];
	scenarios?: ScenarioManifest[];
	registries?: StateRegistry[];
	texts?: Record<string, string>;
	reads?: string[];
}): GuidanceContext {
	const texts = input.texts ?? {};
	const reads = input.reads ?? [];
	const tree = {
		read: async (path: string) => {
			reads.push(path);
			return texts[path] ?? '';
		}
	};
	const files = new Map([[sourcePath, { references: [] }]]);
	return {
		loaded: { stored: input.stored ?? [unitManifest()], scenarios: input.scenarios ?? [], index: { files }, errors: [] },
		tree,
		registries: input.registries ?? [],
		texts: new Map(),
		testAttributions: new Map(),
		testSyntax: new Map()
	} as unknown as GuidanceContext;
}

function thrownBy(run: () => unknown): { name: string; message: string } {
	try {
		run();
	} catch (error) {
		return { name: (error as Error).name, message: (error as Error).message };
	}
	return { name: 'none', message: 'did not throw' };
}

const multi = scenarioFixture('headless', [unitId, 'workflow.other'], [
	{ id: `${prefix}-ready`, coverage: 'required', units: [unitId] },
	{ id: 'workflow-other-ready', coverage: 'required', units: ['workflow.other'] },
	{ id: `${prefix}-unavailable`, coverage: 'inapplicable', units: [unitId] }
]);
const uiState = scenarioFixture('ui', [unitId], [{ id: `${prefix}-ui`, coverage: 'required' }]);
const readyRegistry: StateRegistry = {
	entity: unitId,
	where: 'specification/required-states.json',
	kind: 'required-states',
	states: ['ready']
};

test('Finds the active unit and rejects unknown ids', () => {
	const context = fakeContext({ stored: [unitManifest(), unitManifest('retired', 'workflow.old')] });
	const found = guidanceUnit(context, unitId);
	const retired = thrownBy(() => guidanceUnit(context, 'workflow.old'));
	const wrongCase = thrownBy(() => guidanceUnit(context, unitId.toUpperCase()));

	expect(found.id).toBe(unitId);
	expect(retired.message).toBe('Unknown unit "workflow.old".');
	expect(wrongCase.message).toContain('Unknown unit');
	recordExampleCases(meta('guidanceUnit', 'finds-the-active-unit-and-rejects-unknown-ids'), [
		{ name: 'active id returns the stored manifest', input: { id: unitId }, output: { id: found.id, status: found.status } },
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
	recordExampleCases(meta('guidanceText', 'reads-each-path-once-and-serves-later-calls-from-the-cache'), [
		{ name: 'first read goes to the tree', input: { path: sourcePath }, output: { text: first, treeReads: 1 } },
		{ name: 'second read is served from context.texts', input: { path: sourcePath }, output: { text: second, treeReads: reads.length } }
	]);
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
	recordExampleCases(meta('scenarioStatesFor', 'keeps-only-the-scenario-states-attributed-to-one-unit'), [
		{ name: 'multi-unit scenario keeps only this unit state', input: { unitId }, output: attributed },
		{ name: 'related unit keeps its own prefixed state', input: { unitId: 'workflow.other' }, output: other },
		{ name: 'unit outside scenario.units gets nothing', input: { unitId: 'workflow.unrelated' }, output: unrelated },
		{ name: 'single-unit scenario keeps any non-inapplicable state', input: { unitId }, output: singleUnit }
	]);
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
	recordExampleCases(meta('headlessStateNames', 'lists-headless-states-that-no-registry-declares'), [
		{ name: 'undeclared required headless state is listed', input: { registryStates: [] }, output: headless },
		{ name: 'registry-declared state is suppressed', input: { registryStates: ['ready'] }, output: declared },
		{ name: 'headless-only unit has no attributed UI state', input: { scenarios: 1 }, output: headlessAlone },
		{ name: 'attributed UI state makes unit not headless-only', input: { scenarios: 2 }, output: withUi }
	]);
});

test('Merges registry and scenario states with the default state', () => {
	const context = fakeContext({ scenarios: [multi], registries: [{ ...readyRegistry, states: ['loading', 'ready'] }] });
	const states = namedUnitStates(context, unitManifest());
	const names = states.map((state) => state.name).sort();

	expect(names).toEqual(['default', 'loading', 'ready']);
	expect(states.every((state) => state.origin === 'REQUIRED')).toBe(true);
	recordExampleCases(meta('namedUnitStates', 'merges-registry-and-scenario-states-with-the-default-state'), [
		{ name: 'registry and scenario ready merge by name with default', input: { unitId }, output: names }
	]);
});

test('Guesses states from source branch literals', async () => {
	const source = "export type Props = { status: 'idle' | 'complete' };\nif (state === 'active') render();\n";
	const context = fakeContext({ texts: { [sourcePath]: source } });
	const states = await sourceUnitStates(context, unitManifest());
	const summary = states
		.map((state) => ({ name: state.name, origin: state.origin }))
		.sort((a, b) => a.name.localeCompare(b.name));

	expect(summary.map((state) => state.name)).toEqual(['active', 'complete', 'idle', 'succeeded']);
	expect(states.every((state) => state.origin === 'GUESS')).toBe(true);
	recordExampleCases(meta('sourceUnitStates', 'guesses-states-from-source-branch-literals'), [
		{ name: 'status, state and complete literals in one source file', input: { path: sourcePath }, output: summary }
	]);
});
