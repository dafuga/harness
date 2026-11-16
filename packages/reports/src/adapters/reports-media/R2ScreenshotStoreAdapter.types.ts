// @harness-uid u_pefjibbljk
export interface R2ScreenshotStoreAdapterConfig {
	accountId: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	endpoint?: string;
}
/**
 * A failure this adapter constructs: an invalid image name, missing R2 settings, a non-local
 * endpoint override, or an R2 response with no body.
 */
export class R2ScreenshotStoreError extends Error {
	override name = 'R2ScreenshotStoreError';
}
