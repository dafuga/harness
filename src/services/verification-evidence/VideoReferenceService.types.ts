// @harness-uid u_alfe4qnget
import type {
	Capture,
	VerificationRecord
} from '../../core/verification-evidence/verificationTypes';
import type { PinnedHistory } from './history-status-service/HistoryStatusService.types';
import type { VideoArchiveClip } from './VideoArchiveService.types';
import type { VideoBatchPointer } from '../../utils/verification-evidence/videoClipSchema.types';
import type { VideoOriginRecord } from '../../utils/development-tooling/recordLineage.types';

export interface VideoReferenceInput {
	source: Pick<VerificationRecord['source'], 'commit' | 'tree'>;
	capture: Capture;
	batches: VideoBatchPointer[];
}
export interface TrustedVideoReference {
	clip: VideoArchiveClip;
	pointer: VideoBatchPointer;
	files: Map<string, Buffer>;
	origin: VideoArchiveClip['original'] & { record?: string };
	inputHash: string;
}
export interface VideoReferenceSelection {
	unit: string;
	clipId: string;
	viewport: string;
	inputHash: string;
}
export interface VideoReferenceCandidate {
	/** Proposal only; resolve must prove its media and original attached lineage. */
	capture: Capture;
	batches: [VideoBatchPointer];
	parent: { record: string; revision: string };
}
export interface VideoReferenceContext {
	pinned?: Pick<PinnedHistory, 'evidence'> & Partial<Pick<PinnedHistory, 'notes'>>;
	trail: string[];
	retainMedia?: boolean;
	memo?: VideoReferenceMemo;
}

export interface VideoMaterializationState {
	bytes: number;
	hashes: Map<string, string>;
}

export interface MetadataMemo<T> {
	values: Map<string, { value: T; bytes: number }>;
	pending: Map<string, Promise<T>>;
	bytes: number;
}
export interface VideoReferenceMemo {
	origins: MetadataMemo<VideoOriginProof>;
	catalogs: MetadataMemo<VideoReferenceCandidate[]>;
}
export interface VideoOriginProof {
	record: VideoOriginRecord;
	evidenceCommit: string;
}
