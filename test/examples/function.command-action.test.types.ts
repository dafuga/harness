import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * commandAction is called with the CLI arguments that follow the executable and script names.
 * What each call returned, or the error it threw, is asserted and recorded as the cases of its
 * state.
 */
export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
