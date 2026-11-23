import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * The four public operations of contractSelection, called as their callers call them. None of them
 * opens a file: the made-up sources below need not exist, and the project root is only a lexical
 * anchor, so no temporary directory is used. Records are built the way readContractCatalog builds
 * them, with the manifest fields the selection reads and the rest as the schema requires.
 */
export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

export type Status = 'active' | 'retired';
