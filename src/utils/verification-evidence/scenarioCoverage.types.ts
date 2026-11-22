// @harness-uid u_lnqhwcablp
import type { ScenarioManifest } from '../../core/development-tooling/unitTypes';
import type { Gathered } from './gatherCaptures';
import type {
	ScenarioResult,
	VerificationRecord
} from '../../core/verification-evidence/verificationTypes';
import type { RequiredCapture } from './scenarioRequirements';

export interface CoverageInput {
	scenario: ScenarioManifest;
	/** The exact commit being verified; captures must come from a build of it. */
	commit: string;
	gathered: Gathered[];
	/** True when a check that produced these captures failed or timed out. */
	checkFailed: boolean;
	/** Input hashes computed from this run's exact clean snapshot, before checks execute. */
	/** Reviewer obligations read from the original Git evidence before this run. */
	pendingVideoFlags?: PendingVideoFlags;
	videoSlots?: { unit: string; clipId: string; viewport: string; inputHash: string }[];
	lite?: { deferredChecks: boolean };
	/** The builds the project declares, and the identity of each one setup compiled. */
	builds?: { declared: string[]; compiled: Map<string, string> };
}

export interface CoverageResult {
	videoCoverage?: VideoCoverageSummary[];
	states: ScenarioResult['states'];
	failures: string[];
	pending?: RequiredCapture[];
}

export interface ScenarioJudgement {
	result: ScenarioResult;
	failures: string[];
	pending?: NonNullable<VerificationRecord['lite']>['pendingEvidence'];
}

export type Evidence = ScenarioManifest['evidence'][number];

export type Viewport = ScenarioManifest['viewports'][number];

export interface VideoFrameFlagIdentity {
	id: string;
	unit: string;
	clipId: string;
	viewport: string;
	createdAt: string;
}
export interface PendingVideoFlags {
	known: VideoFrameFlagIdentity[];
	pending: (VideoFrameFlagIdentity & { note: string })[];
}

export interface VideoCoverageSummary {
	graph: string;
	states: number;
	edges: number;
	complete: boolean;
	missing: string[];
}
