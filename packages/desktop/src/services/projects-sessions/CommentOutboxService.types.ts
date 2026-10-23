import type { HumanCommentResult } from '../../models/projects-sessions/ProjectContext.types';

export type PendingComment = Extract<HumanCommentResult, { kind: 'pending' }>;
