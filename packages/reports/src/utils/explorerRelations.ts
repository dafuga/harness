import type { ExplorerEntity, ExplorerRelations, ExplorerSupport } from '../models/Explorer.types';
import type { HarnessRevision, HarnessUnit } from '../models/Harness.types';
import { explorerCategory, explorerRole } from './explorerCategory';
import { explorerEntity } from './explorerEntities';
import { explorerName } from './explorerName';

type Edges = Map<string, string[]>;
/** The units reached from one, each once: those of the five kinds, and those of none. */
interface Reached {
	listed: HarnessUnit[];
	support: HarnessUnit[];
}

/**
 * What is reached from a unit along the edges. A unit of the five kinds ends its path: what it
 * contains is seen by opening it. A unit of no kind is passed through, so what is behind a
 * module or a style sheet stays reachable. A cycle ends where it started.
 */
function reach(units: Map<string, HarnessUnit>, edges: Edges, from: string): Reached {
	const found: Reached = { listed: [], support: [] };
	const seen = new Set([from]);
	const queue = [...(edges.get(from) ?? [])];
	while (queue.length > 0) {
		const unit = units.get(queue.shift() as string);
		if (!unit || seen.has(unit.id)) continue;
		seen.add(unit.id);
		if (explorerCategory(unit) !== null) found.listed.push(unit);
		else {
			found.support.push(unit);
			queue.push(...(edges.get(unit.id) ?? []));
		}
	}
	return found;
}

/** Every page that shows a unit: followed upwards through whatever uses it, to any depth. */
function pagesOf(units: Map<string, HarnessUnit>, consumers: Edges, from: string): HarnessUnit[] {
	const pages: HarnessUnit[] = [];
	const seen = new Set([from]);
	const queue = [...(consumers.get(from) ?? [])];
	while (queue.length > 0) {
		const unit = units.get(queue.shift() as string);
		if (!unit || seen.has(unit.id)) continue;
		seen.add(unit.id);
		if (explorerCategory(unit) === 'pages') pages.push(unit);
		else queue.push(...(consumers.get(unit.id) ?? []));
	}
	return pages;
}

function edgesOf(active: HarnessUnit[]): { uses: Edges; consumers: Edges } {
	const uses: Edges = new Map();
	const consumers: Edges = new Map();
	for (const unit of active) {
		uses.set(
			unit.id,
			unit.dependencies.map((dependency) => dependency.unit)
		);
		for (const { unit: used } of unit.dependencies) {
			consumers.set(used, [...(consumers.get(used) ?? []), unit.id]);
		}
	}
	return { uses, consumers };
}

const support = (unit: HarnessUnit): ExplorerSupport => ({
	id: unit.id,
	role: explorerRole(unit),
	name: explorerName(unit),
	unit
});

/**
 * What an entity contains and what contains it at a revision, each kind in a section of its own:
 * the components, functions, configs and services it uses directly, the pages that show it at
 * any depth, and the entities that use it. Opening a component gives its own components, so a
 * page leads to components, those to components, and those to functions. What it uses that is
 * none of the five kinds is named with its role.
 */
export function explorerRelations(head: HarnessRevision, id: string): ExplorerRelations {
	const active = head.registry.units.filter((unit) => unit.status === 'active');
	const units = new Map(active.map((unit) => [unit.id, unit]));
	const { uses, consumers } = edgesOf(active);
	const entities = (list: HarnessUnit[]) =>
		list
			.map((unit) => explorerEntity(head, unit))
			.filter((entity): entity is ExplorerEntity => entity !== null);
	const contained = units.has(id) ? reach(units, uses, id) : { listed: [], support: [] };
	const using = units.has(id) ? reach(units, consumers, id).listed : [];
	const inside = entities(contained.listed);
	const of = (category: string) => inside.filter((entity) => entity.category === category);
	return {
		pages: entities(units.has(id) ? pagesOf(units, consumers, id) : []),
		components: of('components'),
		functions: of('functions'),
		configs: of('configs'),
		services: of('services'),
		usedBy: entities(using).filter((entity) => entity.category !== 'pages'),
		support: contained.support.map(support)
	};
}
