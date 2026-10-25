import type {
	CommitMessageExampleCallbacks,
	CommitMessageFixture,
	CommitMessageImplementations
} from './commitMessageExamples.types';
import {
	commitLimits,
	commitLimitErrors,
	commitSubjectPrefix,
	commitUnicode,
	commitStoredHash,
	commitCleaned
} from './commitMessageInputExamples';
import {
	writtenGitDrops,
	writtenCleanup,
	writtenVerbatim,
	writtenScissors,
	writtenLongSpaces
} from './writtenMessageExamples';
export function commitMessageExamples(
	implementations: CommitMessageImplementations
): CommitMessageExampleCallbacks {
	return {
		commitMessage: (...input) => invokeCommitMessage(input, implementations),
		writtenMessage: (...input) => invokeWrittenMessage(input, implementations)
	};
}
function invokeCommitMessage(
	input: readonly unknown[],
	implementations: CommitMessageImplementations
): unknown {
	const fixture = fixtureOf(input);
	switch (fixture.$fixture) {
		case 'limits':
			return commitLimits(implementations);
		case 'limit-errors':
			return commitLimitErrors(implementations);
		case 'subject-prefix':
			return commitSubjectPrefix(implementations);
		case 'unicode-line-endings':
			return commitUnicode(implementations);
		case 'stored-hash':
			return commitStoredHash(implementations);
		case 'cleaned-message':
			return commitCleaned(implementations);
		default:
			throw new Error(`Unknown commitMessage fixture ${fixture.$fixture}`);
	}
}
function invokeWrittenMessage(
	input: readonly unknown[],
	implementations: CommitMessageImplementations
): unknown {
	const fixture = fixtureOf(input);
	switch (fixture.$fixture) {
		case 'git-drops':
			return writtenGitDrops(implementations);
		case 'cleanup-whitespace':
			return writtenCleanup(implementations);
		case 'verbatim':
			return writtenVerbatim(implementations);
		case 'scissors':
			return writtenScissors(implementations);
		case 'long-spaces':
			return writtenLongSpaces(implementations, fixture);
		default:
			throw new Error(`Unknown writtenMessage fixture ${fixture.$fixture}`);
	}
}
function fixtureOf(input: readonly unknown[]): CommitMessageFixture {
	const fixture = input[0];
	if (typeof fixture !== 'object' || fixture === null || !Object.hasOwn(fixture, '$fixture'))
		throw new Error('Commit message examples require a fixture marker');
	return fixture as CommitMessageFixture;
}
