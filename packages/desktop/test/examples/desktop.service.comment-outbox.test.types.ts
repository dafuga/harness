import type { CommentOutboxService } from '../../src/services/projects-sessions/CommentOutboxService';

export type SavedComment = Awaited<ReturnType<CommentOutboxService['save']>>;
