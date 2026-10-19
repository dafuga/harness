import type { ImpactInput, KernelGraph } from '../core/kernelTypes';
import type { RuntimeRequest } from '../core/runtimeTypes';

type Random = () => number;

/** Small deterministic generator so every runtime and machine sees identical workloads. */
function random(seed: number): Random {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let mixed = Math.imul(state ^ (state >>> 15), state | 1);
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
	};
}

const pick = (next: Random, size: number): number => Math.floor(next() * size);

/** A synthetic impact request: a layered graph with a few cycles, edited between base and head. */
export function kernelWorkload(nodes: number, seed: number): RuntimeRequest {
	const next = random(seed);
	const ids = Array.from({ length: nodes }, (_, index) => `n${index}`);
	const base: KernelGraph = { nodes: ids, edges: edges(nodes, next) };
	const removed = new Set(ids.filter(() => next() < 0.03));
	const kept = ids.filter((id) => !removed.has(id));
	const added = Array.from({ length: Math.ceil(nodes * 0.03) }, (_, index) => `a${index}`);
	const head: KernelGraph = { nodes: [...kept, ...added], edges: [] };
	head.edges = edges(head.nodes.length, next);
	const sample = (rate: number) => ids.filter(() => next() < rate);
	const input: ImpactInput = {
		base,
		head,
		changed: nodes === 0 ? [] : [...new Set([ids[pick(next, nodes)], ...removed, ...sample(0.01)])],
		uncertain: sample(0.005),
		sinks: ids.filter((_, index) => index >= nodes * 0.8)
	};
	return { operation: 'impact', input };
}

function edges(size: number, next: Random): Array<[number, number]> {
	const list: Array<[number, number]> = [];
	for (let from = 1; from < size; from += 1) {
		const count = 1 + pick(next, 3);
		for (let link = 0; link < count; link += 1) list.push([from, pick(next, from)]);
		if (next() < 0.05) list.push([pick(next, from), from]);
	}
	return list;
}

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
