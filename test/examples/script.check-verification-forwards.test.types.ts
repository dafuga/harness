import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * checkVerificationForwards is called as the script calls it, with a repository root. Each case
 * writes a temporary project folder (a null value in a tree is a folder), runs the check on it and
 * records the registry, the files it was given and what the check returned or threw. Each folder is
 * removed afterwards.
 */
export type Tree = Record<string, string | null>;

export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
