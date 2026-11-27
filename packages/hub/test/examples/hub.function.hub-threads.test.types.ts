import type { hubThreads } from '../../src/utils/networking-security/hubThreads';

export type CommittedThread = Parameters<typeof hubThreads>[0][number];

export type ThreadSummary = ReturnType<typeof hubThreads>[number];

export interface CommentInput {
	id: string;
	actorId: string;
	actorName: string;
	text: string;
	createdAt: string;
}
