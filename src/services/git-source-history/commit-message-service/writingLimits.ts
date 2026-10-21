import { writingHeld } from '../../../utils/git-source-history/writing-limits/writingLimits';

/** Whether a revision declares the limits at all, in any version: what a commit message asks. */
export function writingDeclared(config: string | undefined): boolean {
	return writingHeld(config) !== null;
}
