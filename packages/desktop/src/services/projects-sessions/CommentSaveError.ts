// @harness-uid u_jrtyisgjb5
/** A comment save that is refused: the comment names no project, or its (projectId, requestId) was saved with other input. */
export class CommentSaveError extends Error {
	override name = 'CommentSaveError';
}
