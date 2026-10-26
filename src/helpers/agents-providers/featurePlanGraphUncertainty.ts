import type { ModuleData } from '../../services/git-source-history/ModuleDataService.types';

function diagnostic(reference: unknown): string {
	const fields =
		reference && typeof reference === 'object' ? (reference as Record<string, unknown>) : {};
	const details = ['node', 'reason', 'detail'].map(
		(key) =>
			`${key}=${typeof fields[key] === 'string' ? JSON.stringify(fields[key]) : '[missing or invalid]'}`
	);
	return `Unresolved committed graph reference: ${details.join('; ')}`;
}
function classified(node: ModuleData['sourceGraph']['nodes'][number], data: ModuleData): boolean {
	const units = data.registry.units.filter((unit) => unit.status === 'active');
	if (node.kind === 'scenario') return true;
	if (node.kind === 'unit') {
		const owner = node.unit ?? node.id.slice('unit:'.length);
		return data.registry.units.filter((unit) => unit.id === owner).length === 1;
	}
	if (!node.id.startsWith('file:')) return false;
	const owners = units.filter((unit) => unit.owns.source.includes(node.id.slice('file:'.length)));
	if (owners.length > 1) return false;
	if (
		node.unit &&
		(units.filter((unit) => unit.id === node.unit).length !== 1 ||
			(owners.length === 1 && owners[0]!.id !== node.unit))
	)
		return false;
	if (node.kind === 'test' || (node.kind as string) === 'ignored') return true;
	if (!node.unit) return false;
	return (
		node.kind === 'source' || units.some((unit) => unit.id === node.unit && unit.kind === 'script')
	);
}
function relevant(origin: string, data: ModuleData, reverse: Map<string, string[]>): boolean {
	const nodes = new Map(data.sourceGraph.nodes.map((node) => [node.id, node]));
	const pages = new Set(
		data.registry.units
			.filter((unit) => unit.status === 'active' && unit.kind === 'page')
			.map((unit) => unit.id)
	);
	const pending = [origin],
		seen = new Set<string>();
	while (pending.length) {
		const id = pending.pop()!;
		if (seen.has(id)) continue;
		seen.add(id);
		const node = nodes.get(id);
		if (!node || !classified(node, data)) return true;
		if (pages.has(node.unit ?? '') || (node.kind === 'unit' && pages.has(id.slice('unit:'.length))))
			return true;
		pending.push(...(reverse.get(id) ?? []));
	}
	return false;
}
function graphErrors(data: ModuleData): string[] {
	const graph = data.sourceGraph;
	if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges))
		return ['Committed source graph is missing.'];
	const nodes = new Set(graph.nodes.map((node) => node.id));
	const errors: string[] = [];
	if (nodes.size !== graph.nodes.length) errors.push('Ambiguous committed source graph nodes.');
	for (const edge of graph.edges) {
		if (!nodes.has(edge.from) || !nodes.has(edge.to))
			errors.push(`Unresolved committed source graph edge: ${edge.from} -> ${edge.to}`);
	}
	return errors;
}

/** @pure */
export function featurePlanGraphUncertainty(input: string): string;
export function featurePlanGraphUncertainty(input: ModuleData, references: unknown[]): string[];
export function featurePlanGraphUncertainty(
	input: string | ModuleData,
	references?: unknown[]
): string | string[] {
	if (typeof input === 'string') return input.trim();
	if (!input || !references)
		throw new TypeError('featurePlanGraphUncertainty expects text or committed graph data');
	const errors = graphErrors(input);
	if (errors.length) return [...new Set([...errors, ...references.map(diagnostic)])].sort();
	const nodes = new Map(input.sourceGraph.nodes.map((node) => [node.id, node]));
	const reverse = new Map<string, string[]>();
	for (const edge of input.sourceGraph.edges) {
		if (nodes.get(edge.from)?.kind === 'scenario' || nodes.get(edge.to)?.kind === 'scenario')
			continue;
		reverse.set(edge.to, [...(reverse.get(edge.to) ?? []), edge.from]);
	}
	for (const reference of references) {
		if (
			!reference ||
			typeof reference !== 'object' ||
			!('node' in reference) ||
			typeof reference.node !== 'string' ||
			!('reason' in reference) ||
			typeof reference.reason !== 'string' ||
			!('detail' in reference) ||
			typeof reference.detail !== 'string' ||
			relevant(reference.node, input, reverse)
		)
			errors.push(diagnostic(reference));
	}
	return [...new Set(errors)].sort();
}
