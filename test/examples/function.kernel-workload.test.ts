import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { kernelMutations, kernelTexts } from '../../src/cli/program/run-kernel/kernelWorkload';
import type { Loose } from '../../src/cli/program/run-kernel/kernelWorkload.types';
import { kernelWorkload, edges } from '../../src/utils/execution-runtimes/kernelWorkload';
import type { Random } from '../../src/utils/execution-runtimes/kernelWorkload.types';

const sampleRequest = {
	operation: 'impact',
	input: {
		base: { nodes: ['n0', 'n1'], edges: [[1, 0]] },
		head: { nodes: ['n0', 'n1'], edges: [[1, 0]] },
		changed: ['n1'],
		uncertain: [],
		sinks: ['n1']
	}
};

const meta = (symbol: string, state: string) => ({
	unitId: 'function.kernel-workload',
	symbol,
	state,
	evidence: 'examples-cases',
	file: `${state}.json`
});

function summarise(variant: unknown): Record<string, unknown> {
	const item = variant as Record<string, unknown>;
	return item.round === undefined
		? { operation: item.operation }
		: { operation: item.operation, round: item.round };
}

function workloadSummary(request: { input?: unknown }): Record<string, number> {
	const input = request.input as Loose;
	return {
		baseNodes: input.base.nodes.length,
		headNodes: input.head.nodes.length,
		changed: input.changed.length
	};
}

test('Impact workload repeats for a seed and sizes its added ids', () => {
	const first = kernelWorkload(12, 12345);
	const again = kernelWorkload(12, 12345);
	const wrapped = kernelWorkload(12, -1);
	const unsigned = kernelWorkload(12, 4294967295);
	const empty = kernelWorkload(0, 12345);
	const input = first.input as Loose;
	const added = input.head.nodes.filter((id) => String(id).startsWith('a'));

	expect(first.operation).toBe('impact');
	expect(again).toEqual(first);
	expect(unsigned).toEqual(wrapped);
	expect(input.base.nodes).toEqual(Array.from({ length: 12 }, (_, index) => `n${index}`));
	expect(added).toHaveLength(1);
	expect(empty.input).toEqual({
		base: { nodes: [], edges: [] },
		head: { nodes: [], edges: [] },
		changed: [],
		uncertain: [],
		sinks: []
	});
	recordExampleCases(
		meta('kernelWorkload', 'impact-workload-repeats-for-a-seed-and-sizes-its-added-ids'),
		[
			{
				name: 'twelve nodes with seed 12345',
				input: { nodes: 12, seed: 12345 },
				output: workloadSummary(first)
			},
			{
				name: 'seed -1 matches its unsigned 32-bit value',
				input: { nodes: 12, seed: -1 },
				output: workloadSummary(wrapped)
			},
			{
				name: 'zero nodes yield empty graphs',
				input: { nodes: 0, seed: 12345 },
				output: workloadSummary(empty)
			}
		]
	);
});

test('Mutations cycle fixed variants and add rounds per cycle', () => {
	const variants = kernelMutations(sampleRequest, 20);
	const four = kernelMutations(sampleRequest, 4);

	expect(variants).toHaveLength(20);
	expect(kernelMutations(sampleRequest, 0)).toEqual([]);
	expect(variants[0]).not.toHaveProperty('round');
	expect(variants[3]).toEqual({ operation: 'nope', input: {} });
	expect(variants[13]).toEqual({ operation: 7, input: sampleRequest.input });
	expect(variants[15]).toMatchObject({ operation: 'impact', round: 1 });
	expect(variants[18]).toMatchObject({ operation: 'nope', round: 1 });
	expect(four).toHaveLength(4);
	recordExampleCases(
		meta('kernelMutations', 'mutations-cycle-fixed-variants-and-add-rounds-per-cycle'),
		[
			{
				name: 'four variants take the first fixed mutations',
				input: { request: sampleRequest, count: 4 },
				output: four.map(summarise)
			},
			{
				name: 'twenty variants add a round after the first cycle',
				input: { request: sampleRequest, count: 20 },
				output: variants.map(summarise)
			},
			{ name: 'zero count returns no variants', input: { count: 0 }, output: [] }
		]
	);
});

test('Edge generation links later positions only to earlier ones', () => {
	let calls = 0;
	const constant: Random = () => {
		calls += 1;
		return 0.5;
	};
	const linked = edges(4, constant);
	const linkCalls = calls;
	calls = 0;
	const single = edges(1, constant);

	expect(linked).toEqual([
		[1, 0],
		[1, 0],
		[2, 1],
		[2, 1],
		[3, 1],
		[3, 1]
	]);
	expect(linkCalls).toBeGreaterThan(0);
	expect(single).toEqual([]);
	expect(calls).toBe(0);
	recordExampleCases(meta('edges', 'edge-generation-links-later-positions-only-to-earlier-ones'), [
		{
			name: 'four positions with a constant random value',
			input: { size: 4, random: 0.5 },
			output: linked
		},
		{ name: 'one position yields no edges', input: { size: 1, random: 0.5 }, output: single }
	]);
});

test('Raw request texts cover parser edge cases', () => {
	const texts = kernelTexts();

	expect(texts).toHaveLength(19);
	expect(texts).toContain('{not json');
	expect(texts).toContain('{"operation":"version","ignored":1e-400}');
	expect(texts).toContain('7');
	expect(texts).toContain('{"operation":"version"} trailing');
	recordExampleCases(meta('kernelTexts', 'raw-request-texts-cover-parser-edge-cases'), [
		{ name: 'fixture count', input: {}, output: { count: texts.length } },
		{ name: 'malformed text is kept raw', input: { kind: 'malformed' }, output: '{not json' },
		{
			name: 'trailing text after a valid object',
			input: { kind: 'trailing' },
			output: '{"operation":"version"} trailing'
		}
	]);
});
