import type { CommittedThread } from 'collaboration';
import type { ThreadInfo, ThreadMessage } from '../../../desktop/src/models/Desktop.types';
export function hubThreads(threads: CommittedThread[], offset = 0): ThreadInfo[] {
	return [...threads]
		.sort((a, b) => a.id.localeCompare(b.id))
		.map((t, index) => ({
			id: t.id,
			pin: offset + index + 1,
			version: t.anchor.version,
			imageSha256: t.anchor.imageSha256,
			state: t.anchor.state,
			viewport: t.anchor.viewport,
			region: t.anchor.region,
			messageCount: t.comments.length
		}));
}
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
