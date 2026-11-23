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
import { sourceUnitStates } from './sourceGuidanceStates';

export { guidanceText, sourceUnitStates } from './sourceGuidanceStates';

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

function hasUnitPrefix(stateId: string, unitId: string): boolean {
	const prefix = unitId.replaceAll('.', '-');
	return stateId === prefix || stateId.startsWith(`${prefix}-`);
}

/** @pure Headless viewport-free states: explicit owners win, then this unit's prefix, then shared unowned states. */
function headlessScenarioStates(
	scenario: ScenarioManifest,
	unitId: string
): ScenarioManifest['states'] {
	if (!scenario.units.includes(unitId)) return [];
	const active = scenario.states.filter((state) => state.coverage !== 'inapplicable');
	if (scenario.states.some((state) => state.units?.includes(unitId)))
		return active.filter((state) => state.units?.includes(unitId));
	const unowned = active.filter((state) => !state.units?.length);
	if (scenario.units.length === 1) return unowned;
	const named = unowned.filter((state) => hasUnitPrefix(state.id, unitId));
	if (named.length) return named;
	const others = scenario.units.filter((unit) => unit !== unitId);
	return unowned.filter((state) => !others.some((other) => hasUnitPrefix(state.id, other)));
}

/** @pure Headless viewport-free scenarios use the headless rule; all other scenarios keep the guide rule. */
function namedScenarioStates(
	scenario: ScenarioManifest,
	unitId: string
): ScenarioManifest['states'] {
	return scenario.kind === 'headless' && scenario.viewports.length === 0
		? headlessScenarioStates(scenario, unitId)
		: scenarioStatesFor(scenario, unitId);
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
		for (const state of headlessScenarioStates(scenario, unitId)) {
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
	return (
		headlessStateNames(scenarios, unitId, registryStates).length > 0 &&
		!scenarios.some(
			(scenario) => scenario.kind === 'ui' && scenarioStatesFor(scenario, unitId).length > 0
		)
	);
}

/** Whether a scenario lists this unit on its default state with the coverage; inapplicable needs a reason. */
function declaresDefault(
	scenario: ScenarioManifest,
	unitId: string,
	coverage: 'required' | 'inapplicable'
): boolean {
	return (
		scenario.units.includes(unitId) &&
		scenario.states.some(
			(state) =>
				state.coverage === coverage &&
				state.units?.includes(unitId) === true &&
				unitStateName(unitId, state.id) === 'default' &&
				(coverage === 'required' || Boolean(state.reason?.trim()))
		)
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
		for (const state of namedScenarioStates(scenario, unit.id))
			states.push({
				name: unitStateName(unit.id, state.id),
				origin: 'REQUIRED',
				reasons: [`specification/scenarios/${scenario.id}.json#${state.id}`]
			});
	// A UI scenario's explicit inapplicable default stands in for the generated one, unless a required default exists.
	const scenarios = context.loaded.scenarios;
	const declaredNone =
		scenarios.some(
			(scenario) => scenario.kind === 'ui' && declaresDefault(scenario, unit.id, 'inapplicable')
		) &&
		!states.some((state) => state.name === 'default') &&
		!scenarios.some((scenario) => declaresDefault(scenario, unit.id, 'required'));
	const generated: UnitState[] = declaredNone
		? []
		: [{ name: 'default', origin: 'REQUIRED', reasons: ['Default presentation.'] }];
	return mergeUnitStates([generated, states]);
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
