import { type CaptureLine } from '../core/verifyTypes';
import type { Capture } from '../core/verificationTypes';
import { type MediaFacts } from './mediaFacts';

export interface Gathered {
	line: CaptureLine;
	/** The capture as it will be recorded; its status is decided later. */
	capture: Capture;
	/** What the media really contains, for screenshots and audio. */
	facts?: MediaFacts;
	/** Raw benchmark file contents, for benchmark captures. */
	benchmark?: unknown;
}

export interface GatherResult {
	gathered: Gathered[];
	failures: string[];
}

export { gatherCaptures } from '../services/check-run-service/gatherCaptures';
