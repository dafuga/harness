// @harness-uid u_ffstupjra6
/**
 * A failure of the R2 evidence store: an evidence or replay file name that fails its format check,
 * or an R2 response with no body.
 */
export class R2EvidenceStoreError extends Error {
	override name = 'R2EvidenceStoreError';
}
