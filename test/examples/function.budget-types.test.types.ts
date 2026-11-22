import type { recordExampleCases } from '../support/recordExampleCases';

export type Refusal = { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> };

export type Parsed = { success: true; data: unknown } | { success: false; error: Refusal };

export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
