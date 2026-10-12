import { randomUUID } from 'node:crypto';
import { LocalDocumentAdapter } from '../adapters/LocalDocumentAdapter';
import type { HumanCommentDraft, HumanCommentResult } from '../models/ProjectContext.types';
type PendingComment = Extract<HumanCommentResult, { kind: 'pending' }>;
/** Durable unsent human drafts; intentionally separate from disposable projection storage. */
export class CommentOutboxService {
	private document: LocalDocumentAdapter<PendingComment[]>;
	constructor(file?: string) {
		this.document = new LocalDocumentAdapter(file, () => []);
	}
	save(input: HumanCommentDraft): Promise<PendingComment> {
		const projectId = input.projectId;
		if (!projectId) return Promise.reject(new Error('A comment needs a project.'));
		return this.document.update((drafts) => {
			const previous = drafts.find(
				(draft) => draft.projectId === input.projectId && draft.input.requestId === input.requestId
			);
			if (previous) {
				if (JSON.stringify(previous.input) !== JSON.stringify(input))
					throw new Error('Conflicting comment request.');
				return previous;
			}
			const draft: PendingComment = {
				kind: 'pending',
				projectId,
				draftId: randomUUID(),
				savedAt: new Date().toISOString(),
				input,
				reason: 'Saved locally; not synced. Connect a verified shared project to publish.'
			};
			drafts.push(draft);
			return draft;
		});
	}
	async list(projectId: string): Promise<PendingComment[]> {
		return (await this.document.read()).filter((draft) => draft.projectId === projectId);
	}
}
