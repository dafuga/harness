import type {
	ApprovalRecord,
	CommitId,
	DesignVersion,
	IsoTime,
	PlanAuthor,
	PlanCategory,
	PlanContract,
	PlanLifecycle,
	Sha256
} from './Planning.types';

import type { PlanThread } from './PlanThread.types';

export interface PlanSummary {
	/** Existing canonical identity, or `<category>.<slug>` for a new draft. */
	unitId: string;
	category: PlanCategory;
	slug: string;
	title: string;
	goal: string;
	createdAt: IsoTime;
	createdBy: PlanAuthor;
	baseRevision: CommitId;
	/** The unit folder, relative to the repository root. */
	path: string;
	/** Derived: the commit that created the plan. */
	commit: CommitId;
	lifecycle: PlanLifecycle;
	/** Derived: `specification/units/<unitId>.json` exists at this revision. */
	registered: boolean;
	/** Planning never verifies anything at runtime and never says that it did. */
	verified: false;
	latestVersion: string | null;
	/** The contract of the latest version, or of the plan while it has none. */
	contract: PlanContract;
	contractHash: Sha256;
	/** The approval that is current, if any. */
	approval: ApprovalRecord | null;
	versionCount: number;
	threadCount: number;
}

export interface PlanDetail extends PlanSummary {
	versions: DesignVersion[];
	/** Every approval ever recorded, oldest first; superseded ones stay. */
	approvals: ApprovalRecord[];
	threads: PlanThread[];
}
