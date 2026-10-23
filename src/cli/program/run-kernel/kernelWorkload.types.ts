import type { RuntimeRequest } from '../../../core/execution-runtimes/runtimeTypes';

export interface Loose {
	base: { nodes: unknown[]; edges: unknown[] };
	head: { nodes: unknown[]; edges: unknown[] };
	changed: unknown[];
}

export type Mutation = (input: Loose, request: RuntimeRequest) => unknown;
