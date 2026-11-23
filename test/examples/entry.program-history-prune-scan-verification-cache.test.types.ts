import type { recordExampleCases } from '../support/recordExampleCases';

export type Case = Parameters<typeof recordExampleCases>[1][number];

export type Summary = {
	entries: Array<{ path: string; protectionReasons: string[] }>;
	valid: unknown[];
	problems: string[];
};
