import { expect, test } from 'vitest';
import type { ImpactInput, ImpactOutput } from '../../src/core/kernelTypes';
import { impactKernel } from '../../src/utils/impact-kernel/impactKernel';
import { impactKernelText } from '../../src/workflows/run-kernel/impactKernel';
import { kernelRequest } from '../../src/utils/impact-kernel/kernelRequest';
import { kernelWorkload } from '../../src/utils/kernelWorkload';
import { portableJson } from '../../src/utils/portableJson';
import { kernelVectors, vectorText } from '../support/kernelVectors';

test('the TypeScript reference satisfies every shared vector', () => {
	expect(kernelVectors.length).toBeGreaterThanOrEqual(25);
	for (const vector of kernelVectors) {
		if (vector.request !== undefined) {
			expect(impactKernel(vector.request), vector.name).toEqual(vector.response);
		}
		expect(JSON.parse(impactKernelText(vectorText(vector))), vector.name).toEqual(vector.response);
	}
});

/** Independent fixpoint: a node is affected when it is a seed or depends on an affected node. */
function naive(input: ImpactInput): Set<string> {
	const seeds = input.changed.length > 0 ? [...input.changed, ...input.uncertain] : [];
	const affected = new Set<string>();
	for (const graph of [input.base, input.head]) {
		const reached = new Set(seeds.filter((id) => graph.nodes.includes(id)));
		for (let grew = true; grew; ) {
			grew = false;
			for (const [from, to] of graph.edges) {
				if (reached.has(graph.nodes[to]) && !reached.has(graph.nodes[from])) {
					reached.add(graph.nodes[from]);
					grew = true;
				}
			}
		}
		for (const id of reached) affected.add(id);
	}
	return affected;
}

test('seeded workloads are deterministic and agree with an independent fixpoint', () => {
	for (const [nodes, seed] of [
		[0, 1],
		[1, 2],
		[2, 3],
		[40, 4],
		[40, 5],
		[300, 6],
		[300, 7]
	]) {
		const request = kernelWorkload(nodes, seed);
		expect(kernelWorkload(nodes, seed)).toEqual(request);
		const response = impactKernel(request);
		expect(response.ok, `${nodes}/${seed}`).toBe(true);
		const output = (response as { output: ImpactOutput }).output;
		const ids = output.affected.map((node) => node.id);
		expect(new Set(ids)).toEqual(naive(request.input as ImpactInput));
		expect(new Set(ids).size).toBe(ids.length);
	}
	const large = kernelWorkload(300, 6).input as ImpactInput;
	expect(large.base.nodes.length).toBeGreaterThan(200);
	expect(large.base.nodes).not.toEqual(large.head.nodes);
	expect(large.changed.length).toBeGreaterThan(0);
});

test('self-loops and repeated edges change no distance, coverage or seed', () => {
	const graph = (edges: Array<[number, number]>) => ({ nodes: ['a', 'b', 'c'], edges });
	const request = (edges: Array<[number, number]>) => ({
		operation: 'impact',
		input: {
			base: graph(edges),
			head: graph([
				[1, 0],
				[2, 1]
			]),
			changed: ['a'],
			uncertain: [],
			sinks: ['c']
		}
	});
	const repeated = impactKernel(
		request([
			[1, 0],
			[1, 0],
			[0, 0],
			[2, 1],
			[2, 2]
		])
	);
	expect(repeated).toEqual(
		impactKernel(
			request([
				[1, 0],
				[2, 1]
			])
		)
	);
	expect(repeated).toEqual({
		ok: true,
		output: {
			affected: [
				{ id: 'a', distance: 0, via: 'both', presence: 'both', seed: 'changed' },
				{ id: 'b', distance: 1, via: 'both', presence: 'both', seed: null },
				{ id: 'c', distance: 2, via: 'both', presence: 'both', seed: null }
			],
			uncovered: [],
			unknown: []
		}
	});
});

/** A request held in memory exactly as given: both admission checks accept it unchanged. */
function admitted(graph: { nodes: string[]; edges: number[][] }): Record<string, unknown> {
	const input = { base: graph, head: graph, changed: ['a'], uncertain: [], sinks: ['a'] };
	const request = { operation: 'impact', input };
	expect(portableJson(request)).toBe(true);
	expect(kernelRequest(input)).toEqual({ value: input });
	return request;
}

const changedA = { id: 'a', distance: 0, via: 'both', presence: 'both', seed: 'changed' };

test('an admitted edge with its own iterator is read through that iterator', () => {
	const edge = [1, 0];
	Object.defineProperty(edge, Symbol.iterator, {
		*value() {
			yield 0;
			yield 1;
		}
	});
	const request = admitted({ nodes: ['a', 'b'], edges: [edge] });
	expect(impactKernel(request)).toEqual({
		ok: true,
		output: { affected: [changedA], uncovered: [], unknown: [] }
	});
	const serialized = JSON.parse(impactKernelText(JSON.stringify(request)));
	expect(serialized.output.affected.map((node: { id: string }) => node.id)).toEqual(['a', 'b']);
});

test('admitted nodes are indexed through the arrays their species creates', () => {
	class Nodes extends Array<string> {}
	function mapped(length: number): unknown[] {
		return Object.defineProperty(new Array<unknown>(length), Symbol.iterator, { *value() {} });
	}
	Object.defineProperty(Nodes, Symbol.species, { value: mapped });
	const request = admitted({ nodes: new Nodes('a', 'b'), edges: [] });
	expect(impactKernel(request)).toEqual({
		ok: true,
		output: { affected: [], uncovered: [], unknown: ['a'] }
	});
	expect(JSON.parse(impactKernelText(JSON.stringify(request)))).toEqual({
		ok: true,
		output: { affected: [changedA], uncovered: [], unknown: [] }
	});
});

function mappedNodes(): string[] {
	const nodes = ['a', 'b'];
	Object.defineProperty(nodes, 'map', {
		value(callback: (node: string, index: number, array: string[]) => unknown) {
			const mapped = Array.prototype.map.call(nodes, callback);
			if (!Array.isArray(mapped[0])) return mapped;
			return Object.defineProperty(mapped, Symbol.iterator, {
				*value() {
					yield ['a', 0];
					yield ['b', 99];
				}
			});
		}
	});
	return nodes;
}

test.each([
	{ base: true, head: true, via: null },
	{ base: true, head: false, via: 'head' },
	{ base: false, head: true, via: 'base' }
])('admitted mapped indices discard missing distances: $base/$head', ({ base, head, via }) => {
	const graph = (mapped: boolean) => ({
		nodes: mapped ? mappedNodes() : ['a', 'b'],
		edges: [[1, 0]]
	});
	const input = {
		base: graph(base),
		head: graph(head),
		changed: ['a'],
		uncertain: [],
		sinks: ['a']
	};
	const request = { operation: 'impact', input };
	expect(portableJson(request)).toBe(true);
	expect(kernelRequest(input)).toEqual({ value: input });
	const other = { id: 'b', distance: 1, via, presence: 'both', seed: null };
	expect(impactKernel(request)).toEqual({
		ok: true,
		output: { affected: via ? [changedA, other] : [changedA], uncovered: [], unknown: [] }
	});
});
