// @harness-uid u_4vonmiz2h2
export interface BlobRequest {
	revision: string;
	paths: string[];
}
/** A Git blob read refused for a path with LF, CR, or NUL, or for an invalid cat-file response. */
export class GitBlobReadError extends Error {
	override name = 'GitBlobReadError';
}
