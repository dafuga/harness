import type { CommittedThread } from 'collaboration';
import type { ThreadMessage } from '../../../../desktop/src/models/Desktop.types';

export function hubMessages(thread: CommittedThread): ThreadMessage[] {
	return thread.comments.map((c) => ({
		id: c.id,
		at: c.createdAt,
		author: 'user',
		text: c.text,
		mode: null,
		provider: null,
		model: null,
		version: thread.anchor.version,
		imageSha256: thread.anchor.imageSha256,
		actorId: c.actor.id,
		authorName: c.actor.name
	}));
}
