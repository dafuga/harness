import type { SourceNesting } from '../sourceNesting';

export interface BlockSpan {
	name: string;
	kind: 'function' | 'method';
	start: number;
	end: number;
}

export interface Scope {
	masked: string;
	nesting: SourceNesting;
	depth: number;
	from: number;
	to: number;
	prefix: string;
}
