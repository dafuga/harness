import type { Parsed } from '../kernelRequest';
import { isObject } from '../kernelRequest';
import type { ImpactInput, KernelGraph } from '../../core/kernelTypes';
import type { RuntimeFailure } from '../../core/runtimeTypes';

const malformed = (field: string): Parsed<never> => ({
	error: { code: 'invalid-request', message: `impact input field "${field}" is malformed` }
});

/** Validates an impact input in a fixed order so every implementation reports the same error. */
export function kernelRequest(input: unknown): Parsed<ImpactInput> {
	if (!isObject(input)) {
		return { error: { code: 'invalid-request', message: 'impact input must be an object' } };
	}
	const base = graph(input.base, 'base');
	if ('error' in base) return base;
	const head = graph(input.head, 'head');
	if ('error' in head) return head;
	for (const field of ['changed', 'uncertain', 'sinks']) {
		if (!isStrings(input[field])) return malformed(field);
	}
	const { changed, uncertain, sinks } = input as unknown as ImpactInput;
	const value = { base: base.value, head: head.value, changed, uncertain, sinks };
	const invalid = graphError(value.base, 'base') ?? graphError(value.head, 'head');
	return invalid ? { error: invalid } : { value };
}

function graph(value: unknown, name: string): Parsed<KernelGraph> {
	const fields = isObject(value) ? value : {};
	if (!isStrings(fields.nodes)) return malformed(`${name}.nodes`);
	if (!isPairs(fields.edges)) return malformed(`${name}.edges`);
	return { value: { nodes: fields.nodes, edges: fields.edges } };
}

function graphError(value: KernelGraph, name: string): RuntimeFailure | undefined {
	const seen = new Set<string>();
	for (const id of value.nodes) {
		if (seen.has(id)) {
			return { code: 'invalid-graph', message: `${name} graph repeats node "${id}"` };
		}
		seen.add(id);
	}
	const size = value.nodes.length;
	const index = value.edges.findIndex(([from, to]) => from >= size || to >= size);
	if (index === -1) return undefined;
	return { code: 'invalid-graph', message: `${name} graph edge ${index} is out of range` };
}

function isStrings(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isPairs(value: unknown): value is Array<[number, number]> {
	return Array.isArray(value) && value.every(isPair);
}

function isPair(value: unknown): boolean {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		value.every((item) => Number.isInteger(item) && (item as number) >= 0)
	);
}
