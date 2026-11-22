// @harness-uid u_2eznkaf4qv
import type { Browser } from '@playwright/test';
import type { Capture } from '../../core/verification-evidence/verificationTypes';
import type {
	VideoClip,
	VideoDeclaration,
	VideoManifest
} from '../../utils/verification-evidence/videoClipSchema.types';
import type { VideoSlot } from './VideoEvidenceService.types';
import type {
	NativeRecordingOptions,
	NativeRecordingSession
} from './NativeVideoRecorderService.types';
import type { NativeVideoRecorderService } from './NativeVideoRecorderService';
import type { VideoArchiveService } from './VideoArchiveService';
import type { VideoBatchPointer } from './VideoArchiveService.types';
import type { VideoReferenceService } from './VideoReferenceService';

export interface VideoCaptureSource {
	commit: string;
	tree: string;
}
export interface VideoCapturePin {
	evidence: string | null;
	notes: string | null;
}
export interface VideoCaptureEnvironment {
	schemaVersion: 1;
	repository: string;
	snapshot: string;
	source: VideoCaptureSource;
	slots: VideoSlot[];
	pinned: VideoCapturePin;
}
export interface VideoCaptureInput {
	snapshot: string;
	source: VideoCaptureSource;
	buildId: string;
	declaration: VideoDeclaration;
	evidence: string;
	directory: string;
	env?: Record<string, string | undefined>;
	pinned?: VideoCapturePin;
	recordingAuthorization?: { task: string };
}
export interface VideoCaptureScript extends Pick<
	NativeRecordingOptions,
	'prepare' | 'perform' | 'reset' | 'diagnostics' | 'addressedFlags'
> {
	checkpoint?(session: NativeRecordingSession): Promise<string>;
}
export interface VideoCaptureScriptInput {
	clip: VideoClip;
	slot: VideoSlot;
	viewport: VideoManifest['viewports'][number];
	pendingFlags: { id: string; note: string }[];
}
export interface VideoCaptureOptions extends VideoCaptureInput {
	browserFactory?: () => Promise<Browser>;
	loadScript?: (input: VideoCaptureScriptInput) => Promise<VideoCaptureScript>;
}
export interface VideoCaptureServices {
	references?: Pick<VideoReferenceService, 'candidates' | 'resolve'>;
	archive?: Pick<VideoArchiveService, 'write'>;
	native?: (
		directory: string
	) => Pick<NativeVideoRecorderService, 'record' | 'lookup' | 'acknowledge'>;
}
export interface VideoCaptureReuse {
	slot: VideoSlot;
	capture: Capture;
	batches: VideoBatchPointer[];
}
export interface VideoCapturePlan {
	manifest: VideoManifest;
	known: { id: string; unit: string; clipId: string; viewport: string; createdAt: string }[];
	slots: VideoSlot[];
	record: VideoSlot[];
	reuse: VideoCaptureReuse[];
	pending: {
		id: string;
		unit: string;
		clipId: string;
		viewport: string;
		note: string;
		createdAt: string;
	}[];
}
export interface VideoCaptureRawReceipt {
	cacheRoot: string;
	slotKey: string;
	inputHash: string;
	addressedFlags: string[];
	directory: string;
	videoSha256: string;
	posterSha256: string;
	capture: Capture;
}
export interface VideoCaptureResult {
	source: VideoCaptureSource;
	captures: Capture[];
	videoBatches: VideoBatchPointer[];
	recorded: VideoSlot[];
	reused: VideoSlot[];
	raw: VideoCaptureRawReceipt[];
}
export interface VideoCaptureSidecar {
	schemaVersion: 1;
	batches: VideoBatchPointer[];
	captures: { file: string; capture: Capture }[];
}
