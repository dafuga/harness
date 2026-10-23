import type { HarnessCapture } from '../../models/explorer-ui/Harness.types';
import type { ExplorerArtifact } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerBehaviorRow } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerBehavior } from '../../models/explorer-ui/Explorer.types';

export type BehaviorOutcome = 'passed' | 'failed' | 'missing';

/** One recorded result on one side: how it ended, the capture that holds it and what it holds. */
export interface BehaviorCell {
	outcome: BehaviorOutcome;
	/** Null when the side recorded nothing for the result. */
	capture: HarnessCapture | null;
	/** What the result holds once it was read and checked; undefined while it has not been read. */
	read?: ExplorerArtifact | null;
}

export interface BehaviorLine {
	/** `output`, `assertions` or `trace`, as the capture says. */
	kind: string;
	evidence: string;
	change: ExplorerBehaviorRow['change'];
	/** Where what the two results hold differs, as the host found it. */
	differences: string[];
	before: BehaviorCell;
	after: BehaviorCell;
}

/** One state of one scenario with everything the state recorded on both sides. */
export interface BehaviorGroup {
	scenario: string;
	state: string;
	before: BehaviorOutcome;
	after: BehaviorOutcome;
	lines: BehaviorLine[];
}

export interface EntityBehavior {
	mode: ExplorerBehavior['mode'];
	label: string;
	/** False when no result is recorded for the shown revision at all. */
	recorded: boolean;
	/** True only when the shown revision recorded results and every one of them passed. */
	passed: boolean;
	/** True when what happened between the two sides is not established, or not yet read. */
	unknown: boolean;
	groups: BehaviorGroup[];
	/** What differs or cannot be known, each in words; empty when nothing does. */
	reasons: string[];
	scenarios: ExplorerBehavior['scenarios'];
}
