// @harness-uid u_zhz7hjx43x
export interface FrameClipReference {
	record: string;
	revision: string;
	unit: string;
	clipId: string;
	viewport: string;
}
export interface FrameClip extends FrameClipReference {
	bytes: Buffer;
	sha256: string;
	inputHash: string;
	durationSeconds: number;
	frameRate: number;
	width: number;
	height: number;
	capturedAt: string;
	addressedFlags: string[];
}
export type FrameClipReader = (reference: FrameClipReference) => Promise<FrameClip>;
export interface FrameRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}
export interface FrameFlagInput {
	clip: FrameClipReference;
	atSeconds?: number;
	frameNumber?: number;
	region?: FrameRegion;
	note?: string;
	source?: 'human' | 'automated';
}
export interface FrameFlag {
	schemaVersion: 1;
	id: string;
	clip: FrameClipReference & { sha256: string; inputHash: string };
	atSeconds: number;
	frameNumber: number;
	region?: FrameRegion;
	note: string;
	source: 'human' | 'automated';
	createdAt: string;
	status: 'active' | 'stale' | 'resolved';
	frame: { file: string; sha256: string; bytes: number; mediaType: 'image/png' };
	evidence: { commit: string; path: string };
}
export interface FrameCurrentClip {
	clipId: string;
	viewport: string;
	sha256: string;
}
export interface FrameFeedback {
	text: string;
	images: string[];
	flags: string[];
}
