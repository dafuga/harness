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

export function edges(size: number, next: Random): Array<[number, number]> {
	const list: Array<[number, number]> = [];
	for (let from = 1; from < size; from += 1) {
		const count = 1 + pick(next, 3);
		for (let link = 0; link < count; link += 1) list.push([from, pick(next, from)]);
		if (next() < 0.05) list.push([pick(next, from), from]);
	}
	return list;
}

export { kernelMutations, kernelTexts } from '../cli/program/run-kernel/kernelWorkload';
