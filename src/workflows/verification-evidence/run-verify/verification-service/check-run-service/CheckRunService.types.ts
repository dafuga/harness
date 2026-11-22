// @harness-uid u_3flwsx2557
import type { CaptureLimits } from './captureLimits.types';
import type { VerificationRecord } from '../../../../../core/verification-evidence/verificationTypes';
import type { Gathered } from '../../../../../utils/verification-evidence/gatherCaptures';
import type { PlannedCheck } from '../../../../../utils/verification-evidence/verifyPlan';
import type { VideoSlot } from '../../../../../services/verification-evidence/VideoEvidenceService.types';
import type { VideoBatchPointer } from '../../../../../utils/verification-evidence/videoClipSchema.types';
import type { VideoReferenceService } from '../../../../../services/verification-evidence/VideoReferenceService';

export interface VideoRunContext {
	repository: string;
	source: { commit: string; tree: string };
	slots: Record<string, VideoSlot[]>;
	pinned: { evidence: string | null; notes: string | null };
	/** Parent-process memoized readers; never serialized into a child or evidence descriptor. */
	references?: (fresh: boolean) => Pick<VideoReferenceService, 'resolve'>;
}

export interface RunContext {
	/** Clean export of the commit; every check runs inside it. */
	snapshot: string;
	/** Scratch directory of this run; evidence and logs are written beneath it. */
	directory: string;
	commit: string;
	tree: string;
	profile: string;
	lite?: boolean;
	env: Record<string, string | undefined>;
	signal?: AbortSignal;
	/** Byte caps on what the checks may capture; none when absent. */
	limits?: CaptureLimits;
	videoCapture?: VideoRunContext;
}

export interface CheckOutcome {
	check: PlannedCheck;
	passed: boolean;
	entry: VerificationRecord['tests'][number];
	gathered: Gathered[];
	failures: string[];
	videoBatches?: VideoBatchPointer[];
}
