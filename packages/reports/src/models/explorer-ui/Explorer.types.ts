import type { ExplorerCategory, ExplorerLocation } from '../../../../../src/utils/explorerRoute';
import type { RegressionView } from '../../../../../src/core/regressionTypes';
import type {
	HarnessExplanation,
	HarnessMark,
	HarnessRevisionSummary,
	HarnessUnit
} from './Harness.types';
import type { HarnessReview } from './HarnessBudget.types';

export type * from './ExplorerEvidence.types';
export type {
	ExplorerCategory,
	ExplorerLocation,
	ExplorerSection,
	ExplorerTab
} from '../../../../../src/utils/explorerRoute';

/** Where a page of the explorer is in history, resolved against the index. */
export interface ExplorerScope {
	location: ExplorerLocation;
	/** `current` follows the tip of the branch; `commit` stays on the commit the address names. */
	mode: 'current' | 'commit';
	/** Null for a commit that no branch reaches. */
	branch: string | null;
	/** The head the index records for the branch; null without a branch. */
	tip: string | null;
	/** The commit every contract, measurement, test and capture on the page is bound to. */
	commit: string;
	/** True when the shown commit is the tip, in either mode. */
	atTip: boolean;
	/** The first parent of the shown commit; null for a commit that has none. */
	parent: string | null;
	summary: HarnessRevisionSummary;
}

/** Proven or not; there is nothing in between and no share of it. */
export interface ExplorerVerdict {
	passed: boolean;
	/** What the badge says in a few words. */
	label: string;
	/** Why it is not proven, each in words; empty when it is. */
	reasons: string[];
}

/** A unit as the explorer lists it at one revision. */
export interface ExplorerEntity {
	id: string;
	/** A named runtime caller; identity stays its real owner plus callable name. */
	caller?: { symbol: string; sourceOnly: boolean };
	category: ExplorerCategory;
	/** What it is in a word: `Page`, `Route loader`, `Endpoint`. */
	role: string;
	/** Words a reader is shown; never an id or a path. */
	name: string;
	purpose: string;
	unit: HarnessUnit;
	verdict: ExplorerVerdict;
	/** How the shown commit changed it against its first parent; null when it did not. */
	change: HarnessMark | null;
	/** For a page: the address the application serves it at, when that is known. */
	appRoute: string | null;
	/** For a unit the shown commit removed: the parent commit whose contract is shown. */
	lastAt?: string;
}

/** A unit that is none of the five kinds, kept reachable under what it is. */
export interface ExplorerSupport {
	id: string;
	role: string;
	name: string;
	unit: HarnessUnit;
}

/** What an entity contains and what contains it, each kind in a section of its own. */
export interface ExplorerRelations {
	/** Pages that show the entity, through any depth of components. */
	pages: ExplorerEntity[];
	/** Shells it mounts directly: the frames that put navigation and content together. */
	layouts: ExplorerEntity[];
	/** Components it contains directly; theirs are reached by opening them. */
	components: ExplorerEntity[];
	functions: ExplorerEntity[];
	configs: ExplorerEntity[];
	services: ExplorerEntity[];
	models?: ExplorerEntity[];
	/** Entities that use it directly and are not pages. */
	usedBy: ExplorerEntity[];
	/** What it depends on that is none of the five kinds; entities behind these are listed above. */
	support: ExplorerSupport[];
}

/** One commit that changed an entity, or that cannot say whether it did, newest first. */
export interface ExplorerHistoryRow {
	commit: string;
	subject: string;
	author: string;
	committedAt: string;
	coverage: HarnessRevisionSummary['coverage'];
	/** The first parent of this commit: what it is compared with, never a later commit. */
	previous: string | null;
	/**
	 * `changed` when the history records that the commit changed the entity itself; `unknown`
	 * when the history does not record what the commit changed, with `gap` saying why. A commit
	 * the history records as not changing the entity has no row.
	 */
	standing: 'changed' | 'unknown';
	/** `added`, `removed` or `direct` for a changed row; null for an unknown one. */
	change: HarnessMark | null;
	gap: string | null;
	/** What a record measured here; null where no record measured the entity. */
	measured: {
		record: string;
		size: number | null;
		complexity: number | null;
		dependencies: number | null;
		notes: Record<string, string>;
	} | null;
	/** Against the nearest measured ancestor; null when either is unmeasured. */
	sizeChange: number | null;
	complexityChange: number | null;
	/** Reviewed baselines and approved growth recorded at this commit. */
	reviews: HarnessReview[];
}

/** What one stored revision says about an entity, once it has been read. */
export interface ExplorerHistoryDetail {
	/** Static observations from this exact revision, independent of test verification. */
	sourceSize?: number | null;
	sourceComplexity?: number | null;
	regressions?: RegressionView[];
	/** False when the revision stores no registry or no impact, so the change is not known. */
	known: boolean;
	present: boolean;
	change: HarnessMark | null;
	version: string | null;
	explanations: HarnessExplanation[];
	verdict: ExplorerVerdict | null;
}
