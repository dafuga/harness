// @harness-uid u_w75k4d2324
export type ImageFetch = (url: string, options: RequestInit) => Promise<Response>;

export class ImageGenerationError extends Error {
	override name = 'ImageGenerationError';
}
