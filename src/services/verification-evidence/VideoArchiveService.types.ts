// @harness-uid u_qfigvyo5j5
import type { z } from 'zod';
import type { VideoCapture } from '../../utils/verification-evidence/videoClipSchema.types';
import type { MediaFacts } from '../../utils/verification-evidence/mediaFacts';
import type {
	batchSchema,
	clipSchema,
	manifestSchema,
	pointerSchema,
	slotSchema
} from './video-archive-service/schema';

export type VideoBatchPointer = z.infer<typeof pointerSchema>;
export type VideoArchiveSlot = z.infer<typeof slotSchema>;
export type VideoArchiveClip = z.infer<typeof clipSchema>;
export type VideoArchiveBatch = z.infer<typeof batchSchema>;
export type VideoArchiveManifest = z.infer<typeof manifestSchema>;
export type ArchiveVideoFacts = Extract<MediaFacts, { kind: 'video' }>;
export type VideoArchiveSealedValue =
	| VideoArchiveBatch
	| VideoArchiveManifest
	| {
			video: VideoCapture;
			media: VideoArchiveClip['media'];
			duration: number;
	  };
export interface VideoArchiveInput {
	slot: VideoArchiveSlot;
	original: VideoArchiveClip['original'];
	video: VideoCapture;
	durationSeconds: number;
	sha256: string;
	videoBytes: Buffer;
	posterBytes: Buffer;
}
export interface VideoArchiveDescriptor {
	pointer: VideoBatchPointer;
	batch: VideoArchiveBatch;
}
export interface VideoArchiveRead extends VideoArchiveDescriptor {
	files: Map<string, Buffer>;
}
export interface VideoArchiveCurrent {
	pointer: VideoBatchPointer;
	clip: VideoArchiveClip;
	files: Map<string, Buffer>;
}
export interface AdmittedVideo {
	clip: VideoArchiveClip;
	files: Map<string, Buffer>;
}
