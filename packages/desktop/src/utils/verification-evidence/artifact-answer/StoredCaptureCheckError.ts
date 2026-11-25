// @harness-uid u_x7rrgdmohq
/** A capture whose stored bytes are missing, too large, or not the recorded bytes. */
export class StoredCaptureCheckError extends Error {
	override name = 'StoredCaptureCheckError';
}
