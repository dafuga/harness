import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * The two functions of architectureRules are called as the TypeScript and Svelte adapters call
 * them: auditTypePlacement with an AuditFile, and auditArchitecture with a file's path and its
 * lines. What each was given and what it returned is asserted and recorded as the cases of its
 * state.
 */
export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
