// @harness-uid u_r35cbtisci

export { CaptureReadError } from './CaptureReadError';

/** Optional byte caps from `harness.verify.json`; a missing cap means no limit. */
export interface CaptureLimits {
	/** Largest single capture file a check may leave. */
	maxCaptureBytes?: number;
	/** Largest total of every capture one verification record may keep. */
	maxRecordBytes?: number;
}

export interface CaptureRead {
	sha256: string;
	bytes: number;
	contents?: Buffer;
}
