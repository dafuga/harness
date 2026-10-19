

/** What the subject of a commit starts with: the kind of change it is. */
export const commitPrefixes = ['feat:', 'fix:', 'chore:', 'cleanup:'] as const;

/** How Git cleans a message file before it stores the message. */
export interface MessageCleanup {
	/** `commit.cleanup` of the repository; an edited message is stripped unless this says otherwise. */
	cleanup?: string;
	/** `core.commentChar`; a hash unless the repository chose another. */
	comment?: string;
}

export { writtenMessage, commitMessage } from '../services/commit-message-service/commitMessage';
