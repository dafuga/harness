// @harness-uid u_wwerrde2nk
import type { RepairContext } from './repairSibling.types';
import type { ReviewedCandidate } from '../../../utils/development-tooling/sibling-bug-sweep/scanCandidates.types';

export interface RepairProofInput {
	context: RepairContext;
	candidate: ReviewedCandidate;
	cwd: string;
	ref: string;
}
