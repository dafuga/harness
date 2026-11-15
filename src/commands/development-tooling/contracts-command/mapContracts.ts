import { contractSummary } from './contractSelection';
import type { ContractEntry, ContractMap } from './contracts.types';

/** Traverse recorded edges only; missing contracts remain explicit rather than inferred. */
export function mapContracts(
	entries: ContractEntry[],
	matches: ContractEntry[],
	query: string,
	depth: number
): ContractMap {
	const roots = new Set(matches.map((entry) => entry.id));
	const byId = new Map(entries.map((entry) => [entry.id, entry]));
	const reverse = new Map<string, Set<string>>();
	for (const entry of entries)
		for (const edge of entry.manifest.dependencies) {
			const parents = reverse.get(edge.unit) ?? new Set<string>();
			parents.add(entry.id);
			reverse.set(edge.unit, parents);
		}
	const unresolved = new Set<string>();
	const forward = (id: string) =>
		byId.get(id)?.manifest.dependencies.map((edge) => edge.unit) ?? [];
	const dependencies = traverse(roots, forward, depth);
	const dependents = traverse(roots, (id) => [...(reverse.get(id) ?? [])], depth);
	const summaries = (ids: Set<string>) =>
		[...ids].sort().flatMap((id) => {
			const entry = byId.get(id);
			if (!entry) {
				unresolved.add(id);
				return [];
			}
			return [contractSummary(entry)];
		});
	const result = {
		query,
		matches: matches.map(contractSummary),
		dependencies: summaries(dependencies),
		dependents: summaries(dependents)
	};
	return { ...result, unresolved: [...unresolved].sort() };
}

function traverse(
	roots: Set<string>,
	neighbors: (id: string) => string[],
	depth: number
): Set<string> {
	const seen = new Set(roots);
	const found = new Set<string>();
	let frontier = [...roots];
	for (let hop = 0; hop < depth; hop++) {
		const next = [...new Set(frontier.flatMap(neighbors))].filter((id) => !seen.has(id));
		for (const id of next) {
			seen.add(id);
			found.add(id);
		}
		frontier = next;
	}
	return found;
}
