import type { RuntimeRequest } from '../../../core/runtimeTypes';

interface Loose {
	base: { nodes: unknown[]; edges: unknown[] };
	head: { nodes: unknown[]; edges: unknown[] };
	changed: unknown[];
}

type Mutation = (input: Loose, request: RuntimeRequest) => unknown;

const mutations: Mutation[] = [
	(input) => ({ operation: 'impact', input: { ...input, changed: undefined } }),
	(input) => withGraph(input, 'base', 'nodes', [...input.base.nodes, input.base.nodes[0]]),
	(input) => withGraph(input, 'head', 'edges', [...input.head.edges, [0, 1_000_000]]),
	() => ({ operation: 'nope', input: {} }),
	(input) => withGraph(input, 'base', 'edges', [...input.base.edges, [0]]),
	(input) => withGraph(input, 'head', 'edges', [...input.head.edges, [0, -1]]),
	(input) => ({ operation: 'impact', input: { ...input, sinks: 'all' } }),
	() => ({ operation: 'impact', input: null }),
	(input) => ({ operation: 'impact', input: { ...input, changed: [...input.changed, 5] } }),
	(input) => ({ operation: 'impact', input: { ...input, base: { nodes: 'x', edges: [] } } }),
	(input) => ({ operation: 'impact', input: { ...input, uncertain: undefined } }),
	(input) => withGraph(input, 'base', 'edges', [...input.base.edges, [1.5, 0]]),
	(input) => withGraph(input, 'head', 'nodes', [...input.head.nodes, 7]),
	(_input, request) => ({ ...request, operation: 7 }),
	(input) => withGraph(input, 'head', 'nodes', [...input.head.nodes, input.head.nodes[1]])
];

function withGraph(
	input: Loose,
	graph: 'base' | 'head',
	field: 'nodes' | 'edges',
	value: unknown[]
): unknown {
	return { operation: 'impact', input: { ...input, [graph]: { ...input[graph], [field]: value } } };
}

/** Deterministic malformed variants of a valid request, for cross-implementation parity. */
export function kernelMutations(request: RuntimeRequest, count: number): unknown[] {
	const input = request.input as Loose;
	return Array.from({ length: count }, (_, index) => {
		const variant = mutations[index % mutations.length](input, request);
		const round = Math.floor(index / mutations.length);
		return round === 0 ? variant : { ...(variant as object), round };
	});
}

const versionWith = (field: string): string => `{"operation":"version",${field}}`;

/** Raw request texts at the edge of portable JSON, where parsers are most likely to disagree. */
export function kernelTexts(): string[] {
	const nested = (levels: number) => '['.repeat(levels) + ']'.repeat(levels);
	const graph = (nodes: string, edges: string) => `{"nodes":${nodes},"edges":${edges}}`;
	const impact = (base: string, extra = '') =>
		`{"operation":"impact"${extra},"input":{"base":${base},"head":${graph('[]', '[]')},` +
		'"changed":[],"uncertain":[],"sinks":[]}}';
	return [
		impact(graph('["a"]', '[[0,1e400]]')),
		impact(graph('[]', '[]'), ',"ignored":-1e400'),
		versionWith('"ignored":[1e400]'),
		versionWith(`"ignored":1${'0'.repeat(400)}`),
		versionWith('"ignored":1e-400'),
		versionWith('"ignored":1.7976931348623157e308'),
		impact(graph('["\\ud800"]', '[]')),
		versionWith('"\\udc00":1'),
		versionWith('"ignored":"\\ud83d\\ude00"'),
		versionWith(`"deep":${nested(63)}`),
		versionWith(`"deep":${nested(64)}`),
		versionWith(`"deep":${nested(500)}`),
		versionWith('"ignored":1,"ignored":2'),
		'{not json',
		'',
		'﻿{"operation":"version"}',
		'{"operation":"version"} trailing',
		'[1e400]',
		'7'
	];
}
