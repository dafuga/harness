import type {
	AddCommentInput,
	CommittedThread
} from '../../../collaboration/src/models/Collaboration.types';
import type { DesktopProject } from '../models/ProjectContext.types';
import type {
	EntityDetail,
	ProjectSnapshot,
	ThreadMessage,
	HistoryEvent
} from '../models/Desktop.types';
export function responseRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Invalid hosted response.');
	return value as Record<string, unknown>;
}
export class RemoteProjectResponseValidator {
	actor(value: unknown, principalId: string): void {
		const candidate = responseRecord(value).actor;
		if (!candidate) throw new Error('A verified hosted session is required.');
		const actor = responseRecord(candidate);
		if (actor.id !== principalId || actor.emailVerified !== true)
			throw new Error('Hosted session does not match the signed-in principal.');
	}
	projects(value: unknown): DesktopProject[] {
		if (!Array.isArray(value)) throw new Error('Invalid hosted projects.');
		return value.map((item) => {
			const project = responseRecord(item);
			if (typeof project.id !== 'string' || typeof project.name !== 'string')
				throw new Error('Invalid hosted project.');
			return { id: project.id, name: project.name, kind: 'shared' };
		});
	}
	snapshot(value: unknown, projectId: string): ProjectSnapshot {
		const snapshot = responseRecord(value),
			project = responseRecord(snapshot.project),
			revision = responseRecord(snapshot.revision);
		if (
			project.id !== projectId ||
			typeof project.name !== 'string' ||
			typeof revision.commit !== 'string' ||
			!/^[a-f0-9]{40}$/.test(revision.commit) ||
			!Array.isArray(snapshot.entities) ||
			!Array.isArray(snapshot.branches) ||
			!Array.isArray(snapshot.commits)
		)
			throw new Error('Invalid hosted snapshot.');
		return { ...snapshot, writable: false } as unknown as ProjectSnapshot;
	}
	entity(value: unknown, entityId: string): EntityDetail {
		const entity = responseRecord(value);
		if (
			entity.id !== entityId ||
			!Array.isArray(entity.versions) ||
			!Array.isArray(entity.sources) ||
			!Array.isArray(entity.threads)
		)
			throw new Error('Invalid hosted entity.');
		return entity as unknown as EntityDetail;
	}
	messages(value: unknown): ThreadMessage[] {
		if (
			!Array.isArray(value) ||
			value.some((message) => typeof message?.id !== 'string' || typeof message?.text !== 'string')
		)
			throw new Error('Invalid hosted messages.');
		return value as ThreadMessage[];
	}
	history(value: unknown): { entries: HistoryEvent[]; complete: boolean; nextPage: number | null } {
		const page = responseRecord(value);
		if (
			!Array.isArray(page.entries) ||
			typeof page.complete !== 'boolean' ||
			(page.nextPage !== null && (!Number.isInteger(page.nextPage) || Number(page.nextPage) < 1))
		)
			throw new Error('Invalid hosted history.');
		if (!page.entries.every(validHistoryEvent)) throw new Error('Invalid hosted history event.');
		return page as unknown as {
			entries: HistoryEvent[];
			complete: boolean;
			nextPage: number | null;
		};
	}
	comment(value: unknown, input: AddCommentInput, principalId: string): CommittedThread {
		const thread = responseRecord(value);
		if (
			thread.projectId !== input.projectId ||
			typeof thread.collaborationCommit !== 'string' ||
			!/^[a-f0-9]{40}$/.test(thread.collaborationCommit) ||
			!Array.isArray(thread.comments)
		)
			throw new Error('Hosted comment was not acknowledged.');
		if (input.threadId && thread.id !== input.threadId) throw new Error('Hosted thread mismatch.');
		this.commentIdentity(thread, input, principalId);
		return thread as unknown as CommittedThread;
	}
	private commentIdentity(
		thread: Record<string, unknown>,
		input: AddCommentInput,
		principalId: string
	): void {
		const anchor = responseRecord(thread.anchor);
		for (const key of Object.keys(input.anchor))
			if (
				JSON.stringify(anchor[key]) !==
				JSON.stringify(input.anchor[key as keyof typeof input.anchor])
			)
				throw new Error('Hosted comment anchor mismatch.');
		const message = (thread.comments as CommittedThread['comments']).find(
			(item) => item.requestId === input.requestId
		);
		if (
			!message ||
			message.text !== input.text ||
			message.actor?.id !== principalId ||
			message.actor?.emailVerified !== true
		)
			throw new Error('Hosted comment acknowledgment mismatch.');
	}
}

function validHistoryEvent(entry: { id?: unknown; title?: unknown }) {
	return typeof entry?.id === 'string' && typeof entry?.title === 'string';
}
