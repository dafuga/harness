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
	if (owners.length > 1 || !consistentOwner(node, units, owners)) return false;
	return allowedFile(node, units);
}
function consistentOwner(
	node: ModuleData['sourceGraph']['nodes'][number],
	units: ModuleData['registry']['units'],
	owners: ModuleData['registry']['units']
): boolean {
	if (!node.unit) return true;
	return (
		units.filter((unit) => unit.id === node.unit).length === 1 &&
		(owners.length !== 1 || owners[0].id === node.unit)
	);
}
function allowedFile(
	node: ModuleData['sourceGraph']['nodes'][number],
	units: ModuleData['registry']['units']
): boolean {
	if (node.kind === 'test' || (node.kind as string) === 'ignored') return true;
	if (!node.unit) return false;
	return (
		node.kind === 'source' || units.some((unit) => unit.id === node.unit && unit.kind === 'script')
	);
}

function referenceNode(reference: unknown): string | undefined {
	if (!reference || typeof reference !== 'object') return undefined;
	if (!('node' in reference) || typeof reference.node !== 'string') return undefined;
	if (!('reason' in reference) || typeof reference.reason !== 'string') return undefined;
	if (!('detail' in reference) || typeof reference.detail !== 'string') return undefined;
	return reference.node;
}

function reverseGraph(data: ModuleData): Map<string, string[]> {
	const nodes = new Map(data.sourceGraph.nodes.map((node) => [node.id, node]));
	const reverse = new Map<string, string[]>();
	for (const edge of data.sourceGraph.edges) {
		if (nodes.get(edge.from)?.kind === 'scenario' || nodes.get(edge.to)?.kind === 'scenario')
			continue;
		reverse.set(edge.to, [...(reverse.get(edge.to) ?? []), edge.from]);
	}
	return reverse;
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
function pageAnchors(
	data: ModuleData,
	nodes: Map<string, ModuleData['sourceGraph']['nodes'][number]>
) {
	const edges = new Set(
		data.sourceGraph.edges
			.filter((edge) => edge.via === 'owns')
			.map((edge) => `${edge.from}\0${edge.to}`)
	);
	return data.registry.units
		.filter((unit) => unit.status === 'active' && unit.kind === 'page')
		.every((page) => {
			const id = `unit:${page.id}`;
			const anchor = nodes.get(id);
			if (anchor?.kind !== 'unit' || (anchor.unit && anchor.unit !== page.id)) return false;
			if (!page.owns.source.length) return false;
			return page.owns.source.every((file) => {
				const fileId = `file:${file}`;
				const node = nodes.get(fileId);
				return !!node && classified(node, data) && edges.has(`${id}\0${fileId}`);
			});
		});
}

type GraphNodes = Map<string, ModuleData['sourceGraph']['nodes'][number]>;
type GraphEdge = ModuleData['sourceGraph']['edges'][number];
function scenarioEdge(edge: GraphEdge, nodes: GraphNodes): boolean {
	return nodes.get(edge.from)?.kind === 'scenario' || nodes.get(edge.to)?.kind === 'scenario';
}
function danglingErrors(
	data: ModuleData,
	state: { nodes: GraphNodes; dangling: GraphEdge[]; ambiguous: boolean; complete: boolean }
): string[] {
	const reverse = reverseGraph(data);
	return state.dangling.flatMap((edge) => {
		if (!state.ambiguous && scenarioEdge(edge, state.nodes)) return [];
		if (!state.complete || !state.nodes.has(edge.from) || relevant(edge.from, data, reverse))
			return [`Unresolved committed source graph edge: ${edge.from} -> ${edge.to}`];
		return [];
	});
}

function graphErrors(data: ModuleData, hasReferences: boolean): string[] {
	const graph = data.sourceGraph;
	if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges))
		return ['Committed source graph is missing.'];
	const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
	const errors: string[] = [];
	const ambiguous = nodes.size !== graph.nodes.length;
	if (ambiguous) errors.push('Ambiguous committed source graph nodes.');
	const dangling = graph.edges.filter((edge) => !nodes.has(edge.from) || !nodes.has(edge.to));
	const needsCheck = hasReferences || dangling.some((edge) => !scenarioEdge(edge, nodes));
	const complete = !ambiguous && (!needsCheck || pageAnchors(data, nodes));
	if (!ambiguous && !complete) errors.push('Committed page ownership graph is incomplete.');
	errors.push(...danglingErrors(data, { nodes, dangling, ambiguous, complete }));
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
	const errors = graphErrors(input, references.length > 0);
	if (errors.length) return [...new Set([...errors, ...references.map(diagnostic)])].sort();
	const reverse = reverseGraph(input);
	for (const reference of references) {
		const node = referenceNode(reference);
		if (node === undefined || relevant(node, input, reverse)) errors.push(diagnostic(reference));
	}
	return [...new Set(errors)].sort();
}
