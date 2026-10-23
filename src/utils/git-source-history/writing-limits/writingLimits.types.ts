import type { writingVersions, writingLimits } from './writingLimits';
/** How long one piece of writing may be; a null limit is not counted. */
export interface WritingLimit {
	words: number | null;
	characters: number;
}

export type WritingVersion = (typeof writingVersions)[number];

export type WritingPolicy = Record<keyof typeof writingLimits, WritingLimit>;

/** The parts of a recorded reason that an author writes, and what they are written about. */
export interface WrittenReason {
	unit: string;
	symbol: string;
	behavior: string;
	simplification: { attempt: string };
	performance: { attempt: string };
}
