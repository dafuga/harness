// @harness-uid u_xjxwj3n4f7
export interface ReviewInputFile {
	path: string;
	contents: string;
	hash: string;
}

export class InvalidReviewInputError extends Error {
	override name = 'InvalidReviewInputError';
}
