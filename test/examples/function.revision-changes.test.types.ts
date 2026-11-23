import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * Each case is one call of revisionChanges with the input it was given and the result it
 * returned. The impact is the stored source impact of a commit, the registries say which units
 * a revision holds and in which version, and the parent is the first parent's registry.
 */
export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
