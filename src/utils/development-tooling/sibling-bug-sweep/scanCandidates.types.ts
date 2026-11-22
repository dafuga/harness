// @harness-uid u_wwerrde2nk
import type {
	CandidateVerdict,
	SearchPattern
} from '../../../core/development-tooling/bug-class/bugClassSchemas.types';

export interface SourceRange {
	start: number;
	end: number;
}

export interface SourceCandidate {
	id: string;
	path: string;
	line: number;
	lastLine: number;
	score: number;
	matches: SearchPattern[];
}

export interface CandidateContext extends SourceCandidate {
	fromLine: number;
	source: string;
}

export interface ReviewedCandidate extends SourceCandidate {
	verdict: CandidateVerdict['verdict'] | 'not-reviewed';
	impact: number;
	evidence: string;
}
