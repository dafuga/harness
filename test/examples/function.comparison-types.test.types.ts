import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * The registered comparison schema is run on complete and incomplete benchmark contexts. Each
 * call's input and the schema's actual result, or the issues it reports, is asserted and recorded
 * as the cases of its state.
 */
export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
