import type { ImpactSide } from '../../core/development-tooling/impactTypes';
import type { SourceIndex } from '../../services/development-tooling/source-index-service/SourceIndexService';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { SourceTree } from '../../core/development-tooling/sourceTypes';
import type { WritingVersion } from '../../utils/git-source-history/writing-limits/writingLimits';

/** One revision with everything impact, reasons and measurements read from it. */
export interface RevisionSide extends ImpactSide {
	index: SourceIndex;
	/** Manifests exactly as stored at the revision, before reconciliation with source. */
	stored: ComponentManifest[];
	/** Admission problems from the selected revision, including standardized test coverage. */
	errors?: string[];
	tree?: SourceTree;
	/** The version of the writing limits the verification config of the revision declares. */
	writing?: WritingVersion | null;
}

export interface RevisionRange {
	root?: string;
	/** Revision to compare from; `HEAD` by default, `none` for an empty starting point. */
	base?: string;
	/** Revision to compare to; the working tree when omitted. */
	head?: string;
}
