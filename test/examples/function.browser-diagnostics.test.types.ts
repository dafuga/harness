import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * browserDiagnosticSchema is called the way its callers call it: one test attempt's value goes to
 * safeParse. Each accepted value must come back unchanged, and each refused value must name the
 * exact path and zod code of every problem. No browser is launched; only the parser is exercised.
 */
export type Refusal = { code: string; path: string };

export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
