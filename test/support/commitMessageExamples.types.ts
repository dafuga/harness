import type { MessageCleanup } from '../../src/utils/git-source-history/commitMessage.types';

export interface CommitMessageFixture {
	$fixture: string;
	spaces?: number;
}

export interface CommitMessageImplementations {
	ownerCommitMessage: (message: string) => string[];
	publicCommitMessage: (message: string) => string[];
	ownerWrittenMessage: (file: string, options?: MessageCleanup) => string;
	publicWrittenMessage: (file: string, options?: MessageCleanup) => string;
	ownerCommitPrefixes: readonly string[];
	publicCommitPrefixes: readonly string[];
}

export type CommitMessageExampleCallbacks = {
	commitMessage: (...input: never[]) => unknown;
	writtenMessage: (...input: never[]) => unknown;
};
