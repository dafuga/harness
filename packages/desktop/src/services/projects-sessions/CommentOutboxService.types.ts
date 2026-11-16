// @harness-uid u_jrtyisgjb5
import type { HumanCommentResult } from '../../models/projects-sessions/ProjectContext.types';

export type PendingComment = Extract<HumanCommentResult, { kind: 'pending' }>;

/** A comment save that is refused: the comment names no project, or its (projectId, requestId) was saved with other input. */
export class CommentSaveError extends Error {
	override name = 'CommentSaveError';
}
