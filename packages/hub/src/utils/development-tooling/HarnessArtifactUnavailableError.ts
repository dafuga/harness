// @harness-uid u_ocykouvtlq
/** A harness artifact that cannot be read, named or served; its code property gives the reason. */
export class HarnessArtifactUnavailableError extends Error {
	override name = 'HarnessArtifactUnavailableError';
}
