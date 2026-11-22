// @harness-uid u_3exag5gqwq
import type { RecordBudget } from './captureLimits';
import type { VideoSlot } from '../../../../../services/verification-evidence/VideoEvidenceService.types';
import type { VideoReferenceService } from '../../../../../services/verification-evidence/VideoReferenceService';
import type { Capture } from '../../../../../core/verification-evidence/verificationTypes';
import type { VideoBatchPointer } from '../../../../../utils/verification-evidence/videoClipSchema.types';
import type { CaptureLimits } from './captureLimits.types';

export interface VideoGatherContext {
	repository: string;
	source: { commit: string; tree: string };
	slots: VideoSlot[];
	pinned: { evidence: string | null; notes: string | null };
	references?: (fresh: boolean) => Pick<VideoReferenceService, 'resolve'>;
}
export interface CaptureGatherScope {
	budget?: RecordBudget;
	root?: string;
	video?: VideoGatherContext;
}
export interface GatherVideoSidecar {
	schemaVersion: 1;
	batches: VideoBatchPointer[];
	captures: { file: string; capture: Capture }[];
}
export interface VideoGatherSession {
	directory: string;
	recordPath: string;
	limits: CaptureLimits;
	budget: RecordBudget;
	video?: VideoGatherContext;
	sidecar?: GatherVideoSidecar;
}

export class VideoReferenceAdmissionError extends Error {
	override name = 'VideoReferenceAdmissionError';
}
