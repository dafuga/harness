/** What the subject of a commit starts with: the kind of change it is. */
export const commitPrefixes = ['feat:', 'fix:', 'chore:', 'cleanup:'] as const;

export {
	writtenMessage,
	commitMessage
} from '../../services/git-source-history/commit-message-service/commitMessage';

export type { MessageCleanup } from './commitMessage.types';
