// @harness-uid u_s25qff72z4
import type { HumanCommentDraft } from '../../../models/projects-sessions/ProjectContext.types';
import type { ThreadCommentsState } from './threadComments.svelte';

export class ThreadCommentProjectMismatchError extends Error {
	override name = 'ThreadCommentProjectMismatchError';
}

export type CommentInput = Pick<HumanCommentDraft, 'text' | 'anchor' | 'threadId'>;

export type ThreadComments = ThreadCommentsState;
