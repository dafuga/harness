import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * requestDigest and comparisonContext are called the way the benchmark calls them, with a sum
 * request and the sampling it uses. What each was given and what came back, or why it was
 * refused, is asserted and recorded as the cases of its state.
 */
export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
