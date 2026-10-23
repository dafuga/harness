import type { LoopInput } from '../../workflows/development-tooling/loop-state/loopState';

export type LoopSearchKind = 'loop' | 'template';

export interface LoopSearchResult {
	kind: LoopSearchKind;
	id: string;
	title: string;
	summary: string;
	source: string;
}

export interface SearchLoopsInput extends LoopInput {
	query?: string;
}
