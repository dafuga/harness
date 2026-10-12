/** How long one piece of writing may be; a null limit is not counted. */
export interface WritingLimit {
	words: number | null;
	characters: number;
}

/**
 * The limits of what an author writes about a change. Both of a pair apply: words keep a note
 * short, characters catch one giant token. They bound notes and commit messages only, never a
 * test, a contract, an assertion, a trace, a transcript or evidence.
 */
export const writingLimits = {
	/** What changed in behaviour. */
	behavior: { words: 30, characters: 200 },
	/** One simplification or performance attempt. */
	attempt: { words: 20, characters: 140 },
	/** The first line of a commit message, with its prefix. */
	subject: { words: null, characters: 72 },
	/** The rest of a commit message, with its trailers. */
	body: { words: 60, characters: 400 }
} as const satisfies Record<string, WritingLimit>;

/** The version of these limits a repository declares as `writing` in harness.verify.json. */
export const writingVersion = 1;

/**
 * Whether the verification config of a revision declares these limits. A revision that does
 * not, or whose config cannot be read, is held to none: what was written before a repository
 * adopted the limits stays valid as it is.
 */
export function writingDeclared(config: string | undefined): boolean {
	try {
		const declared = (JSON.parse(config ?? '{}') as { writing?: unknown }).writing;
		return typeof declared === 'number' && declared >= writingVersion;
	} catch {
		return false;
	}
}

/**
 * How long a text is, the one way every check counts: trimmed, with any line ending as one
 * character, words separated by whitespace, and characters as Unicode code points.
 */
export function writingCount(text: string): { words: number; characters: number } {
	const plain = text.replace(/\r\n?/g, '\n').trim();
	return {
		words: plain === '' ? 0 : plain.split(/\s+/).length,
		characters: [...plain].length
	};
}

/** What is wrong with the length of one text: empty, too many words, too many characters. */
export function writingProblems(field: string, text: string, limit: WritingLimit): string[] {
	const { words, characters } = writingCount(text);
	if (characters === 0) return [`${field} is empty.`];
	const over = (count: number, most: number | null, what: string) =>
		most !== null && count > most ? [`${field} has ${count} ${what}; the limit is ${most}.`] : [];
	return [
		...over(words, limit.words, 'words'),
		...over(characters, limit.characters, 'characters')
	];
}

/** The parts of a recorded reason that an author writes, and what they are written about. */
export interface WrittenReason {
	unit: string;
	symbol: string;
	behavior: string;
	simplification: { attempt: string };
	performance: { attempt: string };
}

/**
 * What exceeds the limits in one reason: its behaviour note and each of its two attempts. Every
 * problem names the unit and symbol it is about, the part, the count and the limit.
 */
export function explanationProblems(reason: WrittenReason): string[] {
	const subject = reason.symbol === '*' ? reason.unit : `${reason.unit} ${reason.symbol}`;
	const { behavior, attempt } = writingLimits;
	return [
		...writingProblems('behavior', reason.behavior, behavior),
		...writingProblems('simplification attempt', reason.simplification.attempt, attempt),
		...writingProblems('performance attempt', reason.performance.attempt, attempt)
	].map((problem) => `${subject}: ${problem}`);
}
