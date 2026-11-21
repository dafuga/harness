import type { recordExampleCases } from '../support/recordExampleCases';

export type Parser = { parse(value: unknown): unknown };

export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
