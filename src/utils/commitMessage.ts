import { writingLimits, writingProblems } from './writingLimits';

/** What the subject of a commit starts with: the kind of change it is. */
export const commitPrefixes = ['feat:', 'fix:', 'chore:', 'cleanup:'] as const;

const prefixed = /^(feat|fix|chore|cleanup): \S/;
const unprefixed = 'subject does not start with feat:, fix:, chore: or cleanup:.';
const lines = (text: string) => text.replace(/\r\n?/g, '\n').split('\n');

/** How Git cleans a message file before it stores the message. */
export interface MessageCleanup {
	/** `commit.cleanup` of the repository; an edited message is stripped unless this says otherwise. */
	cleanup?: string;
	/** `core.commentChar`; a hash unless the repository chose another. */
	comment?: string;
}

/** What Git writes after the comment mark above what it shows of a commit and does not store. */
const scissors = '------------------------ >8 ------------------------\n';

/**
 * What stands above the scissors. They are the whole line Git writes, at the start of the text
 * or of a line and ended by a newline; a line that only begins like it cuts nothing.
 */
function aboveScissors(text: string, comment: string): string {
	const at = `\n${text}`.indexOf(`\n${comment} ${scissors}`);
	return at < 0 ? text : text.slice(0, at);
}

/**
 * A text cleaned as `git stripspace` cleans it. A line that starts with the comment mark goes
 * when one is given, and leaves no blank line. A space, a tab or a carriage return at the end
 * of a line goes, and nothing else does. Several blank lines are one. Its two ends are trimmed
 * as a stored message is when it is read, so the hook and the verification measure the same.
 */
function strippedSpace(text: string, comment: string | null): string {
	const lines = text.split('\n').filter((line) => comment === null || !line.startsWith(comment));
	// The run is matched from its first character only, so a long one inside a line costs nothing.
	const ended = lines.map((line) => line.replace(/(?<![ \t\r])[ \t\r]+$/, '')).join('\n');
	return ended.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * The message Git stores from the file it gives a commit-msg hook, as it is read once stored:
 * cut at the scissors, without the lines Git treats as comments when it strips them, without
 * the whitespace Git never stores, and without what is blank at its two ends. A hook is not
 * told whether the diff was shown, so the scissors cut in every mode that cleans. A repository
 * that keeps messages as they are written is measured as written, and a stored message is
 * never passed through this: there a hash is content.
 */
export function writtenMessage(file: string, options: MessageCleanup = {}): string {
	const { cleanup = 'strip', comment = '#' } = options;
	if (cleanup === 'verbatim') return file.trim();
	const kept = ['whitespace', 'scissors'].includes(cleanup);
	return strippedSpace(aboveScissors(file, comment), kept ? null : comment);
}

/**
 * What is wrong with a commit message as it is stored: a subject that is empty, longer than its
 * limit or without its prefix, and a body, trailers included, longer than its limits. The
 * counting is the shared one, so a note and a message are measured the same way.
 */
export function commitMessage(message: string): string[] {
	const [subject = '', ...rest] = lines(message);
	const body = rest.join('\n').trim();
	const length = writingProblems('subject', subject, writingLimits.subject);
	const empty = subject.trim() === '';
	return [
		...length,
		...(empty || prefixed.test(subject) ? [] : [unprefixed]),
		...(body === '' ? [] : writingProblems('body', body, writingLimits.body))
	];
}
