import { expect, test } from 'vitest';
import type { ImpactInput, ImpactOutput } from '../../src/core/kernelTypes';
import { impactKernel, impactKernelText } from '../../src/utils/impactKernel';
import { kernelWorkload } from '../../src/utils/kernelWorkload';
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
