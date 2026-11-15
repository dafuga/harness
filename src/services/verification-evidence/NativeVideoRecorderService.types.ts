// @harness-uid u_akqk4uwm6b
import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { MediaFacts } from '../../utils/verification-evidence/mediaFacts';

export interface NativeRecordingSession {
	context: BrowserContext;
	page: Page;
}
export interface NativeRecordingScript extends NativeRecordingSession {
	/** Call only after the corresponding visible assertion passed. */
	mark: (kind: 'state' | 'edge', id: string) => Promise<void>;
}
export interface NativeRecordingOptions {
	browser: Browser;
	slotKey: string;
	inputHash: string;
	viewport: { width: number; height: number };
	testedRevision: string;
	addressedFlags?: string[];
	diagnostics: { watch(context: BrowserContext): void; finish(): Promise<void> };
	prepare(session: NativeRecordingSession): Promise<void>;
	perform(session: NativeRecordingScript): Promise<void>;
	reset?(session: NativeRecordingSession): Promise<void>;
}
export interface NativeAcquisitionFrame {
	file: string;
	timestamp: number;
	bytes: number;
}
export interface NativeRecordingEvent {
	kind: 'trigger' | 'state' | 'edge';
	id: string;
	timestamp: number;
	atSeconds: number;
	frameNumber: number;
}
export interface NativeRecordingMetadata {
	schemaVersion: 1;
	slotKey: string;
	inputHash: string;
	testedRevision: string;
	capturedAt: string;
	addressedFlags: string[];
	viewport: NativeRecordingOptions['viewport'];
	recipe: 'native-jpeg-sample-previous-h264-yuv420p-30fps-v1';
	marker: { shownTimestamp: number; removedTimestamp: number; nativeTimestamp: number };
	interval: { startTimestamp: number; endTimestamp: number };
	native: {
		frames: NativeAcquisitionFrame[];
		meanFrameRate: number;
		maxGapMs: number;
		bytes: number;
	};
	mapping: { frameNumber: number; sourceFrame: number; nativeTimestamp: number }[];
	events: NativeRecordingEvent[];
	facts: Extract<MediaFacts, { kind: 'video' }>;
	posterFrame: number;
	elapsedMs: number;
	runnerRssBytes: number;
}
export interface NativeRecordingMedia {
	file: string;
	path: string;
	sha256: string;
	bytes: number;
}
export interface NativeRecording {
	directory: string;
	metadata: NativeRecordingMetadata;
	video: NativeRecordingMedia;
	poster: NativeRecordingMedia;
}
export interface NativeRecordingReceipt {
	record: string;
	videoSha256: string;
	posterSha256: string;
}
export interface NativeCapture {
	finishedTimestamp: number;
	frames: NativeAcquisitionFrame[];
	events: Omit<NativeRecordingEvent, 'atSeconds' | 'frameNumber'>[];
	marker: NativeRecordingMetadata['marker'];
}
export interface NativeRecordingLease {
	directory: string;
	finalDirectory: string;
	release(): void;
}

export interface NativeFrameWriter {
	frames: NativeAcquisitionFrame[];
	append(frame: {
		data: Buffer;
		timestamp: number;
		viewportWidth: number;
		viewportHeight: number;
	}): void;
	check(): void;
}
