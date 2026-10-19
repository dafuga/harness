import { retainedBranch } from '../../../utils/harnessAncestry';
import type { HarnessIndex, HarnessRevisionSummary } from "../../../models/Harness.types.ts";

/** The commits a branch contains, newest first; evidence and notes are never among them. */
export function branchCommits(index: HarnessIndex, branch: string): HarnessRevisionSummary[] {
	return index.revisions.filter((revision) =>
		branch === retainedBranch ? revision.retained : revision.branches.includes(branch)
	);
}
