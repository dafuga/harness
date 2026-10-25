import { recordedRelations } from './explorerRelationsRecorded';
import type { Graph, Edges, Reached, Entity, RelationsReader } from './explorerRelations.types';
import type {
	ExplorerCategory,
	ExplorerEntity,
	ExplorerRelations,
	ExplorerSupport
} from '../../models/explorer-ui/Explorer.types';
import type { HarnessRevision, HarnessUnit } from '../../models/explorer-ui/Harness.types';
import { explorerCategory, explorerRole } from './explorerCategory';
import { explorerEntity } from './explorerEntities';
import { explorerName } from './explorerName';

/**
 * Each unit reached from one along the edges, once and nearest first. `onward` is shown each and
 * says whether its own edges are followed. A cycle ends where it started.
 */
function walk(
	graph: Graph,
	edges: Edges,
	from: string,
	onward: (unit: HarnessUnit) => boolean
): void {
	const seen = new Set([from]);
	const queue = [from];
	for (let at = 0; at < queue.length; at++) {
		for (const next of edges.get(queue[at]) ?? []) {
			const unit = graph.units.get(next);
			if (!unit || seen.has(unit.id)) continue;
			seen.add(unit.id);
			if (onward(unit)) queue.push(unit.id);
		}
	}
}

/**
 * What is reached from a unit along the edges. A unit of the five kinds ends its path: what it
 * contains is seen by opening it. A unit of no kind is passed through, so what is behind a
 * module or a style sheet stays reachable. A cycle ends where it started.
 */
function reach(graph: Graph, edges: Edges, from: string): Reached {
	const found: Reached = { listed: [], support: [] };
	walk(graph, edges, from, (unit) => {
		const listed = graph.category(unit) !== null;
		(listed ? found.listed : found.support).push(unit);
		return !listed;
	});
	return found;
}

/** Every page that shows a unit: followed upwards through whatever uses it, to any depth. */
function pagesOf(graph: Graph, from: string): HarnessUnit[] {
	const pages: HarnessUnit[] = [];
	walk(graph, graph.consumers, from, (unit) => {
		const page = graph.category(unit) === 'pages';
		if (page) pages.push(unit);
		return !page;
	});
	return pages;
}

/** Models used anywhere in a page's dependency graph, including behind components and services. */
function categoryOf(graph: Graph, from: string, category: ExplorerCategory): HarnessUnit[] {
	const models: HarnessUnit[] = [];
	walk(graph, graph.uses, from, (unit) => {
		if (graph.category(unit) === category) models.push(unit);
		return true;
	});
	return models;
}

/** Framework layouts are mounted by routing, without an explicit page import. */
function routeLayouts(unit: HarnessUnit, active: HarnessUnit[]): string[] {
	const pages = unit.owns.source.filter((path) => path.endsWith('/+page.svelte'));
	return active
		.filter(
			(layout) =>
				layout.kind === 'layout' &&
				layout.owns.source.some(
					(path) =>
						path.endsWith('/+layout.svelte') &&
						pages.some((page) => page.startsWith(path.slice(0, -14)))
				)
		)
		.map((layout) => layout.id);
}

/** The active units of a revision and their edges; each list of users is made once and grown. */
function graphOf(head: HarnessRevision): Graph {
	const active = head.registry.units.filter((unit) => unit.status === 'active');
	const uses: Edges = new Map();
	const consumers: Edges = new Map();
	for (const unit of active) {
		const dependencies = [
			...new Set([
				...unit.dependencies.map((dependency) => dependency.unit),
				...routeLayouts(unit, active)
			])
		];
		uses.set(unit.id, dependencies);
		for (const used of dependencies) {
			const users = consumers.get(used);
			if (users) users.push(unit.id);
			else consumers.set(used, [unit.id]);
		}
	}
	const categories = new Map<HarnessUnit, ExplorerCategory | null>();
	const category = (unit: HarnessUnit) => {
		const known = categories.get(unit);
		if (known !== undefined) return known;
		const found = explorerCategory(unit);
		categories.set(unit, found);
		return found;
	};
	return { units: new Map(active.map((unit) => [unit.id, unit])), uses, consumers, category };
}

/**
 * Each unit as this revision lists it, worked out once. An entity already built for the very
 * same unit is handed out as it is, with its verdict; one listed as its parent last held it is
 * not, because its verdict is not that of this revision.
 */
function entitiesOf(head: HarnessRevision, built: ExplorerEntity[]): Entity {
	const known = new Map<HarnessUnit, ExplorerEntity | null>(
		built.filter((entity) => entity.lastAt === undefined).map((entity) => [entity.unit, entity])
	);
	return (unit) => {
		const found = known.get(unit);
		if (found !== undefined) return found;
		const entity = explorerEntity(head, unit);
		known.set(unit, entity);
		return entity;
	};
}

const support = (unit: HarnessUnit): ExplorerSupport => ({
	id: unit.id,
	role: explorerRole(unit),
	name: explorerName(unit),
	unit
});

function related(graph: Graph, id: string, entity: Entity): ExplorerRelations {
	const held = graph.units.has(id);
	const entities = (list: HarnessUnit[]) =>
		list.map((unit) => entity(unit)).filter((found): found is ExplorerEntity => found !== null);
	const contained = held ? reach(graph, graph.uses, id) : { listed: [], support: [] };
	const using = held ? reach(graph, graph.consumers, id).listed : [];
	const inside = entities(contained.listed);
	const of = (category: string) => inside.filter((found) => found.category === category);
	return {
		pages: entities(held ? pagesOf(graph, id) : []),
		layouts: of('layouts'),
		components: of('components'),
		functions: of('functions'),
		configs: of('configs'),
		services: of('services'),
		types: of('types'),
		apis:
			held && graph.category(graph.units.get(id)!) === 'pages'
				? entities(categoryOf(graph, id, 'apis'))
				: of('apis'),
		models:
			held && graph.category(graph.units.get(id)!) === 'pages'
				? entities(categoryOf(graph, id, 'models'))
				: of('models'),
		usedBy: entities(using).filter((found) => found.category !== 'pages'),
		support: contained.support.map(support)
	};
}

/**
 * The relations of one revision, read as often as they are asked for: its edges are built on the
 * first question and the answer for each id is kept, so asking again gives the same object. What
 * is related reuses `built`, the entities already listed for this same revision, so no verdict
 * is worked out twice. It holds what it read for as long as whoever asked keeps it, and no longer.
 */
export function explorerRelationsReader(
	head: HarnessRevision,
	built: ExplorerEntity[] = []
): RelationsReader {
	const answers = new Map<string, ExplorerRelations>();
	const entity = entitiesOf(head, built);
	let graph: Graph | null = null;
	return (id) => {
		const known = answers.get(id);
		if (known) return known;
		const recorded = recordedRelations(head, id, entity);
		if (recorded) {
			answers.set(id, recorded);
			return recorded;
		}

		graph ??= graphOf(head);
		const found = related(graph, id, entity);
		answers.set(id, found);
		return found;
	};
}

/**
 * What an entity contains and what contains it at a revision, each kind in a section of its own:
 * the components, functions, configs and services it uses directly, the pages that show it at
 * any depth, and the entities that use it. Opening a component gives its own components, so a
 * page leads to components, those to components, and those to functions. What it uses that is
 * none of the five kinds is named with its role. It is read afresh from the revision each time.
 */
export function explorerRelations(head: HarnessRevision, id: string): ExplorerRelations {
	return explorerRelationsReader(head)(id);
}

export type { RelationsReader } from './explorerRelations.types';
