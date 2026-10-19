import type { CommittedThread } from '../../../collaboration/src/models/Collaboration.types';
import type { ThreadMessage } from '../models/Desktop.types';
import type { HumanCommentResult } from '../models/ProjectContext.types';

/** A thread message as it is shown: who wrote it and whether it left this device. */
export interface ThreadEntry extends ThreadMessage {
	authorName?: string;
	pending?: boolean;
	note?: string;
	detail?: string;
}

export type PendingComment = Extract<HumanCommentResult, { kind: 'pending' }>;

export function commentEntries(thread: CommittedThread): ThreadEntry[] {
	return thread.comments.map((comment) => ({
		id: comment.id,
		at: comment.createdAt,
		author: 'user',
		authorName: comment.actor.name,
		text: comment.text,
		mode: null,
		provider: null,
		model: null,
		version: thread.anchor.version,
		imageSha256: thread.anchor.imageSha256
	}));
}

export {
	threadInfo,
	pendingEntries,
	requestEntry
} from '../components/thread-panel/commentEntries';
