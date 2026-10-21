import type { ThreadEntry } from '../../utils/commentEntries';
import type { CommittedThread } from '../../../../collaboration/src/models/Collaboration.types';

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
