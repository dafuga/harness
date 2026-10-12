import { writingLimits, writingProblems } from './writingLimits';

/** What the subject of a commit starts with: the kind of change it is. */
export const commitPrefixes = ['feat:', 'fix:', 'chore:', 'cleanup:'] as const;

const prefixed = /^(feat|fix|chore|cleanup): \S/;
const unprefixed = 'subject does not start with feat:, fix:, chore: or cleanup:.';
const lines = (text: string) => text.replace(/\r\n?/g, '\n').split('\n');

/** How Git cleans a message file before it stores the message, as far as it changes its length. */
export interface MessageCleanup {
	/** `commit.cleanup` of the repository; an edited message is stripped unless this says otherwise. */
	cleanup?: string;
	/** `core.commentChar`; a hash unless the repository chose another. */
	comment?: string;
}

/**
 * The message Git stores from the file it gives a commit-msg hook: without the lines Git treats
 * as comments and without what follows the scissors, unless the repository keeps messages as
 * they are written. A stored message is never passed through this: there a hash is content.
 */
export function writtenMessage(file: string, options: MessageCleanup = {}): string {
	const { cleanup = 'strip', comment = '#' } = options;
	if (cleanup === 'whitespace' || cleanup === 'verbatim') return file.trim();
	const all = lines(file);
	const cut = all.findIndex((line) => line.startsWith(`${comment} ------------------------ >8`));
	const kept = cut < 0 ? all : all.slice(0, cut);
	const stored = cleanup === 'scissors' ? kept : kept.filter((line) => !line.startsWith(comment));
	return stored.join('\n').trim();
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
