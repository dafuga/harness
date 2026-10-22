/** How long one piece of writing may be; a null limit is not counted. */
export interface WritingLimit {
	words: number | null;
	characters: number;
}

/** The versions of the limits a repository can declare as `writing` in harness.verify.json. */
export const writingVersions = [1, 2] as const;

export type WritingVersion = (typeof writingVersions)[number];

/** The newest version: the one a repository declares to be held to the limits as they are now. */
export const writingVersion: WritingVersion = 2;

/**
 * The widest limits there are, which are those of version 1. Both of a pair apply: words keep a
 * note short, characters catch one giant token. A commit message has these limits in every
 * version, and a reader is shown whole what any version accepts; a reason is judged by
 * `writingPolicy`, under the version of the revision it explains. They bound notes and commit
 * messages only, never a test, a contract, an assertion, a trace, a transcript or evidence.
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

export type WritingPolicy = Record<keyof typeof writingLimits, WritingLimit>;

/** How many words one attempt may have under each version; a version changes nothing else. */
const attemptWords: Record<WritingVersion, number> = { 1: 20, 2: 15 };

/** The limits of one version: what a reason of a revision that declares it is held to. */
export function writingPolicy(version: WritingVersion): WritingPolicy {
	return { ...writingLimits, attempt: { ...writingLimits.attempt, words: attemptWords[version] } };
}

/**
 * The version of the limits a revision is held to: the one its verification config declares.
 * Null when it declares none or its config cannot be read, so what was written before a
 * repository adopted the limits stays valid as it is. A later version than this Harness knows
 * is held to the newest it does know, never to a weaker one.
 */
export function writingHeld(config: string | undefined): WritingVersion | null {
	try {
		const declared = (JSON.parse(config ?? '{}') as { writing?: unknown }).writing;
		if (typeof declared !== 'number') return null;
		return [...writingVersions].reverse().find((version) => declared >= version) ?? null;
	} catch {
		return null;
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
 * What exceeds the limits of one version in a reason: its behaviour note and each of its two
 * attempts. The version is that of the revision the reason explains, never one read from the
 * date it carries. Every problem names the unit and symbol, the part, the count and the limit.
 */
export function explanationProblems(reason: WrittenReason, version: WritingVersion): string[] {
	const subject = reason.symbol === '*' ? reason.unit : `${reason.unit} ${reason.symbol}`;
	const { behavior, attempt } = writingPolicy(version);
	return [
		...writingProblems('behavior', reason.behavior, behavior),
		...writingProblems('simplification attempt', reason.simplification.attempt, attempt),
		...writingProblems('performance attempt', reason.performance.attempt, attempt)
	].map((problem) => `${subject}: ${problem}`);
}
