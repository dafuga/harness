import type { ThreadInfo } from '../../models/development-tooling/Desktop.types';
import type { HumanCommentDraft } from '../../models/projects-sessions/ProjectContext.types';

/** Where on an entity a thread sits: an exact image and region, or the entity itself. */
export type ThreadTarget = Pick<
	ThreadInfo,
	'version' | 'imageSha256' | 'state' | 'viewport' | 'region' | 'option'
>;

export type CommentAnchor = HumanCommentDraft['anchor'];
