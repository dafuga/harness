import type { CaptureStanding } from '../../utils/reports-media/captureProvenance';
import type { BrowserDiagnostic } from '../../../../../src/core/browserDiagnostics';
import type {
	HarnessCapture,
	HarnessRecord,
	HarnessRevision,
	HarnessScenario
} from './Harness.types';

/** How one required thing stands in the record that judges a revision. */
export type CoverageStanding =
	| 'passed'
	| 'failed'
	| 'stale'
	| 'missing'
	| 'incomplete'
	| 'inapplicable';

/** One capture a state must have, and what the record holds for it. */
export interface ExplorerSlotCoverage {
	evidence: string;
	kind: string;
	viewport: string | null;
	capture: HarnessCapture | null;
	standing: CoverageStanding;
	reason: string | null;
}

/** One declared state of a scenario, judged against the record. */
export interface ExplorerStateCoverage {
	state: string;
	/** `required`, `missing` or `inapplicable`, as the scenario declares it. */
	declared: string;
	standing: CoverageStanding;
	reasons: string[];
	slots: ExplorerSlotCoverage[];
}

/** One scenario that covers a unit, judged against the record: itself, its tests, its states. */
export interface ExplorerScenarioCoverage {
	scenario: string;
	title: string;
	kind: string;
	/** The worst of its own standing and that of its states. */
	standing: CoverageStanding;
	/** What is wrong with the scenario itself: no result, a failure, its lineage, its tests. */
	reasons: string[];
	/** Each declared test with its status in this record; null when the record does not hold it. */
	tests: Array<{ id: string; status: string | null; browserErrors?: BrowserDiagnostic[] }>;
	/** The commit whose record produced the result, when it was inherited. */
	inheritedFrom: string | null;
	states: ExplorerStateCoverage[];
}

/** One recorded capture of a scenario that covers the entity. */
export interface ExplorerCapture {
	scenario: string;
	state: string;
	capture: HarnessCapture;
	standing: CaptureStanding;
	/** Retained focused pixels; this grants no full-verification verdict. */
	focused?: {
		loop: string;
		status: string;
		record: string;
		viewport?: { width: number; height: number };
	};
	/** True for a passed, stored capture that stands as proof for the commit of its side. */
	usable: boolean;
	/** True only for a usable capture made from the build of exactly that commit. */
	current: boolean;
	/** The commit whose build produced it, when it was inherited from an earlier record. */
	inheritedFrom: string | null;
}

/** One side of what an entity is shown with: a revision, the record that judges it, its captures. */
export interface ExplorerSide {
	commit: string;
	/** Null when the history does not hold the revision. */
	detail: HarnessRevision | null;
	/** The one record that judges the revision: badge, measurements and evidence all read it. */
	record: HarnessRecord | null;
	captures: ExplorerCapture[];
	/** Each scenario that covers the entity on this side, state by state. */
	coverage: ExplorerScenarioCoverage[];
	/** Why this side shows nothing usable, when it does not. */
	gap: string | null;
}

/**
 * What an entity is shown with. At a branch tip there is one side and never a pair; at a selected
 * commit `before` is its first parent, or null with `initial` saying that it has none.
 */
export interface ExplorerEvidence {
	mode: 'current' | 'commit';
	/**
	 * The scenarios that cover the entity on either side, with the states, viewports and evidence
	 * of both, so what a commit removed can still be selected and seen on the side that had it.
	 */
	scenarios: HarnessScenario[];
	after: ExplorerSide;
	before: ExplorerSide | null;
	initial: string | null;
	/** Why the two sides are not like for like: profile, viewport sizes, a redefined scenario. */
	incomparable: string[];
}

/**
 * What happened to a recorded result between two sides. `differs` is said from the hashes alone:
 * the bytes are not the same, and only reading both says whether the behaviour is.
 */
export type ExplorerChange = 'unchanged' | 'differs' | 'changed' | 'added' | 'removed' | 'unknown';

/** One headless result on both sides: equal bytes are unchanged behaviour, never assumed. */
export interface ExplorerBehaviorRow {
	scenario: string;
	state: string;
	evidence: string;
	/** `output`, `assertions`, `trace` or `benchmark`, as the capture says. */
	kind: string;
	before: HarnessCapture | null;
	after: HarnessCapture | null;
	change: ExplorerChange;
	/** Where what the two results hold differs, as paths; filled once both were read. */
	differences: string[];
	/** What each result holds, once it was read and checked; absent before that. */
	beforeRead?: ExplorerArtifact | null;
	afterRead?: ExplorerArtifact | null;
}

export interface ExplorerBehavior {
	/** `current` shows one run and compares nothing. */
	mode: 'current' | 'commit';
	rows: ExplorerBehaviorRow[];
	/** `unknown` whenever the two sides cannot establish what happened. */
	summary: ExplorerChange | 'not-compared';
	/** Why the summary is unknown, in words; null otherwise. */
	reason: string | null;
	scenarios: Array<{ id: string; title: string; before: string | null; after: string | null }>;
}

/** What a behaviour artifact says, read from its own fields; nothing is filled in. */
export interface ExplorerArtifactBehavior {
	scenario: string | null;
	environment: string | null;
	fixture: string | null;
	/** Each step as it was recorded: a sentence, or a structured step. */
	steps: unknown[];
	/** Undefined when the artifact records none. */
	input?: unknown;
	output?: unknown;
	/** `detail` holds what else an assertion recorded, such as what was expected and found. */
	assertions: Array<{ name: string; passed: boolean | null; detail?: Record<string, unknown> }>;
	trace: unknown[];
	/** Every other field of the artifact, as recorded. */
	other: Record<string, unknown>;
}

/** The bytes of one recorded artifact, checked against the hash its capture states. */
export interface ExplorerArtifact {
	/** True only when the bytes that were read have the recorded SHA-256. */
	verified: boolean;
	problem: string | null;
	text: string;
	/** The parsed document, when the bytes are JSON. */
	document: unknown;
	behavior: ExplorerArtifactBehavior | null;
}

/** One recorded case of a function: what it was given, and what was observed for that. */
export interface ExplorerArtifactCase {
	name: string;
	input: unknown;
	/** What was returned; absent when the call threw. */
	output?: unknown;
	/** What was thrown; an observed error is never an output. */
	error?: unknown;
	failed: boolean;
}

/** The cases a recorded result holds, or why it shows none. */
export type ExplorerArtifactCases =
	| {
			kind: 'cases';
			/** Calls of one symbol, or the one input and output a test observed end to end. */
			source: 'invocations' | 'observation';
			symbol: string | null;
			cases: ExplorerArtifactCase[];
	  }
	| { kind: 'gap'; why: string };
