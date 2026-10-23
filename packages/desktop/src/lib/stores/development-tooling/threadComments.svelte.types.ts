import type { HumanCommentDraft } from '../../../models/projects-sessions/ProjectContext.types';
import type { ThreadCommentsState } from './threadComments.svelte';

export type CommentInput = Pick<HumanCommentDraft, 'text' | 'anchor' | 'threadId'>;

export type ThreadComments = ThreadCommentsState;
