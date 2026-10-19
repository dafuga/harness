import { PendingComment, ThreadEntry } from '../../utils/commentEntries';
import type { CommittedThread } from "../../../../collaboration/src/models/Collaboration.types.ts";
import type { DesignVersion, ThreadInfo } from "../../models/Desktop.types.ts";
import type { HumanCommentResult } from "../../models/ProjectContext.types.ts";
import type { RunDraft } from "../../utils/composeModes";

const pendingNote = 'Pending on this device · not shared';

export function threadInfo(thread: CommittedThread, pin: number): ThreadInfo {
	const { version, imageSha256, state, viewport, region } = thread.anchor;
	return {
		id: thread.id,
		pin,
		version,
		imageSha256,
		state,
		viewport,
		region,
		messageCount: thread.comments.length
	};
}

function pendingEntry(draft: PendingComment, threads: ThreadInfo[]): ThreadEntry {
	const thread = threads.find((item) => item.id === draft.input.threadId);
	return {
		id: draft.draftId,
		at: draft.savedAt,
		author: 'user',
		text: draft.input.text,
		mode: null,
		provider: null,
		model: null,
		version: draft.input.anchor.version,
		imageSha256: draft.input.anchor.imageSha256,
		pending: true,
		note: thread ? `${pendingNote} · Thread #${thread.pin}` : pendingNote,
		detail: draft.reason
	};
}

/** Drafts of one entity that never left this device. They are never described as saved. */
export function pendingEntries(
	results: HumanCommentResult[],
	entityId: string,
	threads: ThreadInfo[]
): ThreadEntry[] {
	return results
		.filter((item): item is PendingComment => item.kind === 'pending')
		.filter((item) => item.input.anchor.entityId === entityId)
		.map((item) => pendingEntry(item, threads));
}

/** The request a person just sent to an agent, shown until the saved thread is read again. */
export function requestEntry(
	runId: string,
	request: RunDraft,
	design: DesignVersion | undefined
): ThreadEntry {
	return {
		id: runId,
		at: new Date().toISOString(),
		author: 'user',
		text: request.text,
		mode: request.mode === 'ask' ? null : request.mode,
		provider: request.provider,
		model: request.model,
		version: design?.version || null,
		imageSha256: design?.images[0]?.sha256 || null
	};
}
