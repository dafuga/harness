import type { Workspace } from './workspace.svelte';
import type { HumanCommentDraft, HumanCommentResult } from '../../models/ProjectContext.types';
import type { PendingComment } from '../../utils/commentEntries';

export type CommentInput = Pick<HumanCommentDraft, 'text' | 'anchor' | 'threadId'>;

/**
 * Human comments of one entity view. A comment goes to the comment operation only: nothing here
 * can start a run. A draft the bridge kept on this device is pending, never acknowledged.
 */
class ThreadCommentsState {
	pending = $state<PendingComment[]>([]);
	/** The collaboration commit of the last comment that was shared; empty otherwise. */
	acknowledged = $state('');
	error = $state('');
	busy = $state(false);
	private attempt: { key: string; requestId: string } | null = null;
	constructor(private workspace: Workspace) {}
	/** Read on every load, so drafts survive a restart and a cleared cache. */
	async load() {
		const bridge = this.workspace.bridge;
		if (!bridge?.pendingComments) return;
		const expected = this.workspace.projectId;
		try {
			const drafts = await bridge.pendingComments(this.workspace.context);
			if (expected !== this.workspace.projectId) return;
			this.pending = drafts.filter((item): item is PendingComment => item.kind === 'pending');
		} catch (cause) {
			this.error = String(cause);
		}
	}
	async post(input: CommentInput): Promise<HumanCommentResult | null> {
		const bridge = this.workspace.bridge;
		if (!bridge?.addComment || this.busy) return null;
		const context = this.workspace.context;
		this.busy = true;
		this.error = '';
		this.acknowledged = '';
		try {
			const draft = { ...input, requestId: this.requestId(input), ...context };
			if (draft.threadId === undefined) delete draft.threadId;
			const result = await bridge.addComment(draft);
			if (context.projectId && result.projectId !== context.projectId)
				throw new Error('The bridge answered for another project.');
			this.attempt = null;
			this.accept(result);
			return result;
		} catch (cause) {
			this.error = String(cause);
			return null;
		} finally {
			this.busy = false;
		}
	}
	/** A retry of the same comment repeats its request id, so it cannot be stored twice. */
	private requestId(input: CommentInput) {
		const key = JSON.stringify([input.text, input.threadId ?? null, input.anchor]);
		if (this.attempt?.key !== key) this.attempt = { key, requestId: crypto.randomUUID() };
		return this.attempt.requestId;
	}
	private accept(result: HumanCommentResult) {
		if (result.kind === 'shared') this.acknowledged = result.thread.collaborationCommit;
		else this.pending = [...this.pending.filter((item) => item.draftId !== result.draftId), result];
	}
}
export function createThreadCommentsStore(workspace: Workspace) {
	return new ThreadCommentsState(workspace);
}
export type ThreadComments = ThreadCommentsState;
