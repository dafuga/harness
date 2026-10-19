import type { CoverageStanding } from "../models/Explorer.types";
import type { HarnessRecord, HarnessScenario, HarnessUnit } from "../models/Harness.types";

type Result = HarnessRecord['scenarios'][number];

export type Told = [CoverageStanding, string];

/** One declared scenario with its result, and the commit its captures must be of. */
export interface Judged {
	declared: HarnessScenario;
	result: Result;
	record: HarnessRecord;
	bound: string;
}

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

type Users = Map<string, string[]>;

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

/**
 * A scenario as it applies to one unit: with the states that show that unit. A state names what
 * it is a state of, a page as a rule, and so shows what that is made of in the registry of the
 * revision. A unit is shown by the states that name it and by no other; a unit no state names,
 * by the states that name something made of it; and a unit that nothing named is made of, as an
 * endpoint behind every screen is, stays under every state.
 */
export function scenarioFor(
	declared: HarnessScenario,
	unit: string,
	units: HarnessUnit[] = []
): HarnessScenario {
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
