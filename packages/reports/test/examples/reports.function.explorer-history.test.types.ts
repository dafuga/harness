import type { recordExampleCases } from '../../../../test/support/recordExampleCases';

/**
 * Both symbols are called the way the explorer calls them, over the loaded fixture history: the
 * selected commit and its ancestry, a commit the index does not hold, and one stored revision.
 * Each state records one symbol, with the input it was given and the result it returned.
 */
export type Cases = Parameters<typeof recordExampleCases>[1];
