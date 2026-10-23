import type { HarnessMark, HarnessRevision } from '../../models/explorer-ui/Harness.types';

export interface HarnessImpact {
	/**
	 * `recorded` is what a verification record measured, `source` what the index computed from the
	 * source of both commits, and `computed` what two stored registries alone can tell.
	 */
	source: 'recorded' | 'source' | 'computed';
	/** True when the change put every test and scenario in scope. */
	expanded?: boolean;
	/** Number of files that differ, when the source of both commits was compared. */
	files?: number;
	record?: string;
	direct: string[];
	indirect: string[];
	added: string[];
	removed: string[];
	scenarios: string[];
	uncertain: Array<{ node: string; reason: string; detail: string }>;
	marks: Map<string, HarnessMark>;
}

/** What the stored sides of two revisions gave when they were compared. */
export interface ComparedSides {
	base: string;
	head: string;
	impact: NonNullable<HarnessRevision['sourceImpact']>;
}

export {
	harnessImpact,
	comparedSides
} from '../../components/explorer-ui/harness-compare/harnessImpact';
