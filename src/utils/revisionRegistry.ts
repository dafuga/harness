import type { ComponentManifest, ScenarioManifest } from '../core/unitTypes';

export interface RevisionRegistry {
	/** False when the revision stores no unit registry; nothing is substituted for it. */
	available: boolean;
	gap?: string;
	units: Array<{
		id: string;
		kind: string;
		status: string;
		title: string;
		responsibility: string;
		dependencies: Array<{ unit: string; via: string }>;
		scenarios: string[];
	}>;
	scenarios: Array<{
		id: string;
		title: string;
		kind: string;
		units: string[];
		states: Array<{ id: string; coverage: string }>;
	}>;
	graph: {
		nodes: Array<{ id: string; kind: 'unit' | 'scenario' }>;
		edges: Array<{ from: string; to: string; via: string }>;
	};
}

const byId = <Item extends { id: string }>(left: Item, right: Item) =>
	left.id < right.id ? -1 : 1;

/**
 * The registry of one revision as it is stored there: its units, its scenarios and the unit
 * graph they declare. This is the recorded graph of that revision, not a recomputed one.
 */
export function revisionRegistry(
	manifests: ComponentManifest[],
	scenarios: ScenarioManifest[]
): RevisionRegistry {
	const units = [...manifests].sort(byId).map((unit) => ({
		id: unit.id,
		kind: unit.kind,
		status: unit.status,
		title: unit.title,
		responsibility: unit.responsibility,
		dependencies: unit.dependencies.map(({ unit: target, via }) => ({ unit: target, via })),
		scenarios: unit.scenarios
	}));
	const listed = [...scenarios].sort(byId).map((scenario) => ({
		id: scenario.id,
		title: scenario.title,
		kind: scenario.kind,
		units: scenario.units,
		states: scenario.states.map(({ id, coverage }) => ({ id, coverage }))
	}));
	const depends = units.flatMap((unit) =>
		unit.dependencies.map(({ unit: target, via }) => ({
			from: `unit:${unit.id}`,
			to: `unit:${target}`,
			via
		}))
	);
	const covers = listed.flatMap((scenario) =>
		scenario.units.map((unit) => ({
			from: `scenario:${scenario.id}`,
			to: `unit:${unit}`,
			via: 'covers'
		}))
	);
	const nodes = [
		...units.map((unit) => ({ id: `unit:${unit.id}`, kind: 'unit' as const })),
		...listed.map((scenario) => ({ id: `scenario:${scenario.id}`, kind: 'scenario' as const }))
	];
	const available = units.length > 0;
	const gap = available ? {} : { gap: 'no unit registry is stored at this revision' };
	return {
		available,
		...gap,
		units,
		scenarios: listed,
		graph: { nodes, edges: [...depends, ...covers] }
	};
}
