// @harness-uid u_bfad3bg4oz
import { WorkingTreeAdapter } from '../../../adapters/git-source-history/WorkingTreeAdapter';
import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import { loadUnits } from '../load-units/loadUnits';
import type {
	ComponentManifest,
	ScenarioManifest
} from '../../../core/development-tooling/unitTypes';
import type {
	GuidanceContext,
	GuidanceOptions,
	StateRegistry,
	UnitState
} from './guideUnits.types';
import { contractStates, mergeUnitStates, unitStateName } from './contractStates';
import { stateRegistries } from './stateRegistries';
import { fail } from '../../../core/development-tooling/errors';

export async function guidanceContext(
	options: GuidanceOptions,
	committed: boolean
): Promise<GuidanceContext> {
	const root = options.root ?? process.cwd();
	const tree = committed
		? await CommitTreeAdapter.open(root, 'HEAD')
		: new WorkingTreeAdapter(root);
	const loaded = await loadUnits(root, tree);
	if (loaded.errors.length) fail(loaded.errors.join('\n'));
	return {
		loaded,
		tree,
		registries: await stateRegistries(tree, root, options.requiredStates),
		texts: new Map(),
		testAttributions: new Map(),
		testSyntax: new Map()
	};
}

export function guidanceUnit(context: GuidanceContext, id: string): ComponentManifest {
	const unit = context.loaded.stored.find((item) => item.id === id && item.status === 'active');
	return unit ?? fail(`Unknown unit "${id}".`);
}

export async function guidanceText(context: GuidanceContext, path: string): Promise<string> {
	if (!context.texts.has(path)) context.texts.set(path, await context.tree.read(path));
	return context.texts.get(path)!;
}

/** @pure Return only the scenario states attributed to this unit by the guide's existing rule. */
export function scenarioStatesFor(
	scenario: ScenarioManifest,
	unitId: string
): ScenarioManifest['states'] {
	if (!scenario.units.includes(unitId)) return [];
	const specific = scenario.states.some((state) => state.units?.includes(unitId));
	return scenario.states.filter(
		(state) =>
			state.coverage !== 'inapplicable' &&
			(!specific || state.units?.includes(unitId)) &&
			(scenario.units.length === 1 ||
				state.id === unitId.replaceAll('.', '-') ||
				state.id.startsWith(`${unitId.replaceAll('.', '-')}-`))
	);
}

/** @pure Required headless states not also declared by UI scenarios or state registries. */
export function headlessStateNames(
	scenarios: ScenarioManifest[],
	unitId: string,
	registryStates: StateRegistry[]
): string[] {
	const excluded = new Set(
		registryStates
			.filter((row) => row.entity === unitId)
			.flatMap((row) => row.states.map((state) => unitStateName(unitId, state)))
	);
	for (const scenario of scenarios.filter((item) => item.kind === 'ui'))
		for (const state of scenarioStatesFor(scenario, unitId))
			excluded.add(unitStateName(unitId, state.id));
	const names = new Set<string>();
	for (const scenario of scenarios.filter(
		(item) => item.kind === 'headless' && item.viewports.length === 0
	))
		for (const state of scenarioStatesFor(scenario, unitId)) {
			const name = unitStateName(unitId, state.id);
			if (state.coverage === 'required' && !excluded.has(name)) names.add(name);
		}
	return [...names];
}

/** @pure Headless-only units have required headless states and no attributed UI states. */
export function headlessOnly(
	scenarios: ScenarioManifest[],
	unitId: string,
	registryStates: StateRegistry[] = []
): boolean {
	return headlessStateNames(scenarios, unitId, registryStates).length > 0 &&
		!scenarios.some(
			(scenario) =>
				scenario.kind === 'ui' && scenarioStatesFor(scenario, unitId).length > 0
		);
}

export function namedUnitStates(context: GuidanceContext, unit: ComponentManifest): UnitState[] {
	const states = context.registries
		.filter((row) => row.entity === unit.id)
		.flatMap((row) =>
			row.states.map((name) => ({
				name: unitStateName(unit.id, name),
				origin: 'REQUIRED' as const,
				reasons: [row.where]
			}))
		);
	for (const scenario of context.loaded.scenarios)
		for (const state of scenarioStatesFor(scenario, unit.id))
			states.push({
				name: unitStateName(unit.id, state.id),
				origin: 'REQUIRED',
				reasons: [`specification/scenarios/${scenario.id}.json#${state.id}`]
			});
	return mergeUnitStates([
		[{ name: 'default', origin: 'REQUIRED', reasons: ['Default presentation.'] }],
		states
	]);
}

/** Source branch literals are hints: importing a dependency never establishes rendered proof. */
export async function sourceUnitStates(
	context: GuidanceContext,
	unit: ComponentManifest
): Promise<UnitState[]> {
	const states: UnitState[] = [];
	for (const path of sourceStatePaths(context, unit)) {
		const source = await guidanceText(context, path);
		states.push(...sourceBranchStates(source, path));
	}
	return mergeUnitStates([states]);
}

function sourceStatePaths(context: GuidanceContext, unit: ComponentManifest): Set<string> {
	const paths = new Set(unit.owns.source);
	for (const path of unit.owns.source)
		for (const dependency of stateReferences(context, path, /(?:[Nn]otice\.ts|Progress\.svelte)$/))
			paths.add(dependency);
	for (const path of [...paths].filter((path) => !unit.owns.source.includes(path)))
		for (const dependency of stateReferences(context, path, /\.types\.ts$/)) paths.add(dependency);
	return paths;
}

function stateReferences(context: GuidanceContext, path: string, pattern: RegExp): string[] {
	return (context.loaded.index.files.get(path)?.references ?? []).flatMap((reference) =>
		reference.path && pattern.test(reference.path) ? [reference.path] : []
	);
}

function sourceBranchStates(source: string, path: string): UnitState[] {
	const states: UnitState[] = [];
	const matches = source.matchAll(
		/\b(?:status|state|phase|mode|variant)\s*(?:===?|!==?)\s*['"]([\w-]+)['"]|\b(?:status|state|phase|mode)\??\s*:\s*((?:['"][\w-]+['"]\s*\|?\s*)+)|\b\w*(?:Status|State|Phase|Mode)\s*=\s*((?:['"][\w-]+['"]\s*\|?\s*)+)/g
	);
	for (const match of matches) {
		const names = match[1]
			? [match[1]]
			: [...(match[2] ?? match[3]).matchAll(/['"]([\w-]+)['"]/g)].map((item) => item[1]);
		for (const name of names)
			states.push({ name, origin: 'GUESS', reasons: [`Source branch/type in ${path}.`] });
		if (names.includes('complete'))
			states.push({
				name: 'succeeded',
				origin: 'GUESS',
				reasons: [`Successful complete branch in ${path}.`]
			});
	}
	return states;
}

export async function allUnitStates(
	context: GuidanceContext,
	unit: ComponentManifest
): Promise<UnitState[]> {
	return mergeUnitStates([
		namedUnitStates(context, unit),
		contractStates(unit.contract).map((state) => ({ ...state, origin: 'GUESS' })),
		await sourceUnitStates(context, unit)
	]);
}
