import type { RevisionRegistry } from '../../../utils/revisionRegistry';
import type { ModuleRelationships } from '../ModuleDataService.types';
import { explorerCategory } from '../../../../packages/reports/src/utils/explorer-ui/explorerCategory';

/** Materialize the revision graph once; consumers receive identifiers, never a graph search. */
export function moduleRelationships(
	registry: RevisionRegistry
): Record<string, ModuleRelationships> {
	const { active, units, uses, consumers } = relationGraph(registry);
	const category = (id: string) => explorerCategory(units.get(id)!);
	return Object.fromEntries(
		active.map((unit) => {
			const inside = walk(units, unit.id, uses, (id) => category(id) !== null);
			const all = walk(units, unit.id, uses, () => false);
			const of = (kind: string) => inside.filter((id) => category(id) === kind);
			return [
				unit.id,
				{
					pages: walk(units, unit.id, consumers, (id) => category(id) === 'pages').filter(
						(id) => category(id) === 'pages'
					),
					layouts: of('layouts'),
					components: of('components'),
					functions: of('functions'),
					configs: of('configs'),
					services: of('services'),
					types: of('types'),
					apis: all.filter((id) => category(id) === 'apis'),
					models: all.filter((id) => category(id) === 'models'),
					usedBy: walk(units, unit.id, consumers, (id) => category(id) !== null).filter(
						(id) => category(id) !== null && category(id) !== 'pages'
					),
					support: inside.filter((id) => category(id) === null)
				}
			];
		})
	);
}

function relationGraph(registry: RevisionRegistry) {
	const active = registry.units.filter((unit) => unit.status === 'active');
	const units = new Map(active.map((unit) => [unit.id, unit]));
	const uses = new Map<string, string[]>(),
		consumers = new Map<string, string[]>();
	for (const unit of active) {
		const pages = unit.owns.source.filter((path) => path.endsWith('/+page.svelte'));
		const layouts = active.filter(
			(other) =>
				other.kind === 'layout' &&
				other.owns.source.some(
					(path) =>
						path.endsWith('/+layout.svelte') &&
						pages.some((page) => page.startsWith(path.slice(0, -14)))
				)
		);
		const targets = [
			...new Set([
				...unit.dependencies.map((edge) => edge.unit),
				...layouts.map((layout) => layout.id)
			])
		];
		uses.set(unit.id, targets);
		for (const target of targets)
			consumers.set(target, [...(consumers.get(target) ?? []), unit.id]);
	}

	return { active, units, uses, consumers };
}

function walk(
	units: Map<string, RevisionRegistry['units'][number]>,
	id: string,
	edges: Map<string, string[]>,
	stop: (id: string) => boolean
): string[] {
	const seen = new Set([id]),
		queue = [id],
		found: string[] = [];
	for (let at = 0; at < queue.length; at++)
		for (const next of edges.get(queue[at]) ?? []) {
			if (seen.has(next) || !units.has(next)) continue;
			seen.add(next);
			found.push(next);
			if (!stop(next)) queue.push(next);
		}
	return found;
}
