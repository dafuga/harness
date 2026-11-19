// @harness-uid u_i4vqq2pyhj
import type { Users } from './explorerState.types';
import type { CoverageStanding } from '../../models/explorer-ui/Explorer.types';
import type { HarnessScenario, HarnessUnit } from '../../models/explorer-ui/Harness.types';

const located = / in (?:[\w.@+-]+\/)+[\w.@+[\]-]+/g;

const path = /(?:[\w.@+-]+\/)+[\w.@+[\]-]+\.[A-Za-z0-9]+/g;

/**
 * A reason as a reader is told it: without the file a recorded sentence names. Where something
 * is, in source or among the runner's files, is shown under Details and in the stored record.
 */
export function reasonText(text: string): string {
	return text.replace(located, '').replace(path, 'a file');
}

const order: CoverageStanding[] = ['failed', 'stale', 'missing', 'incomplete', 'passed'];

const usersOf = new WeakMap<HarnessUnit[], Users>();

/** What uses each unit directly, read once from the units of a registry. */
function users(units: HarnessUnit[]): Users {
	const known = usersOf.get(units);
	if (known) return known;
	const found: Users = new Map();
	for (const unit of units.filter((item) => item.status === 'active')) {
		for (const { unit: used } of unit.dependencies) {
			found.set(used, [...(found.get(used) ?? []), unit.id]);
		}
	}
	usersOf.set(units, found);
	return found;
}

/** Everything made of a unit: what uses it, and what uses that, to any depth. */
function madeOf(units: HarnessUnit[], unit: string): Set<string> {
	const direct = users(units);
	const seen = new Set<string>();
	const queue = [...(direct.get(unit) ?? [])];
	while (queue.length > 0) {
		const next = queue.shift() as string;
		if (seen.has(next)) continue;
		seen.add(next);
		queue.push(...(direct.get(next) ?? []));
	}
	return seen;
}

const visualKinds = new Set(['page', 'shell', 'component', 'layout', 'partial']);

/** Whether a state shows a visual module: it names it, or names nothing at all. */
const drawsVisual = (state: HarnessScenario['states'][number], unit: string) =>
	!state.units?.length || state.units.includes(unit);

const hasUnitPrefix = (stateId: string, unit: string) => {
	const prefix = unit.replaceAll('.', '-');
	return stateId === prefix || stateId.startsWith(`${prefix}-`);
};

/**
 * The states a headless scenario without viewports attributes to one of its units, as the guide
 * does: the states that name it; else the unnamed states that carry its prefix; else the unnamed
 * states no other unit of the scenario prefixes. A unit the scenario does not list has none.
 */
function headlessStates(declared: HarnessScenario, unit: string): HarnessScenario['states'] {
	if (!declared.units.includes(unit)) return [];
	const owned = declared.states.filter((state) => state.units?.includes(unit));
	if (owned.length > 0) return owned;
	const unowned = declared.states.filter((state) => !state.units?.length);
	if (declared.units.length === 1) return unowned;
	const named = unowned.filter((state) => hasUnitPrefix(state.id, unit));
	if (named.length > 0) return named;
	const others = declared.units.filter((other) => other !== unit);
	return unowned.filter((state) => !others.some((item) => hasUnitPrefix(state.id, item)));
}

/**
 * A scenario as it applies to one unit: with the states that show that unit. A visual module is
 * shown only by the states that name it and by those that name nothing, which stand for the whole
 * scenario. A state that names only what it is drawn in does not show it was drawn: what imports
 * it lends it no capture. A headless scenario without viewports attributes its states as the guide
 * does, so a dependency keeps the shared states its dependants do not own. Any other unit is shown
 * by the states that name it; one no state names, by the states that name something made of it in
 * the registry of the revision; and one that nothing named is made of, as an endpoint behind every
 * screen is, stays under every state.
 */
export function scenarioFor(
	declared: HarnessScenario,
	unit: string,
	units: HarnessUnit[] = []
): HarnessScenario {
	const kind = units.find((item) => item.id === unit)?.kind ?? '';
	if (visualKinds.has(kind)) {
		return { ...declared, states: declared.states.filter((state) => drawsVisual(state, unit)) };
	}
	if (declared.kind === 'headless' && declared.viewports.length === 0) {
		const headless = headlessStates(declared, unit);
		if (headless.length > 0) return { ...declared, states: headless };
	}
	const own = declared.states.filter((state) => state.units?.includes(unit));
	if (own.length > 0) return { ...declared, states: own };
	const made = madeOf(units, unit);
	const drawn = declared.states.filter((state) => state.units?.some((id) => made.has(id)));
	return drawn.length > 0 ? { ...declared, states: drawn } : declared;
}

/** The worst of several standings; what has nothing that applies is inapplicable. */
export function coverageWorst(standings: CoverageStanding[]): CoverageStanding {
	return order.find((standing) => standings.includes(standing)) ?? 'inapplicable';
}

export { captureUnbound, explorerState } from './explorer-verdict/explorerState';

export type { Told, Judged } from './explorerState.types';
