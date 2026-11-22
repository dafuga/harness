// @harness-uid u_x7rrgdmohq
import type { HarnessCapture } from '$reports/models/explorer-ui/Harness.types';

export type Listed = Pick<HarnessCapture, 'kind' | 'mediaType' | 'sha256' | 'media' | 'gap'>;

/** A capture whose stored bytes are missing, too large, or not the recorded bytes. */
export class StoredCaptureCheckError extends Error {
	override name = 'StoredCaptureCheckError';
}
