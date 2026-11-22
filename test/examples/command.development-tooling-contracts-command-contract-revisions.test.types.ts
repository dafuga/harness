import type { recordExampleCases } from '../support/recordExampleCases';
import type { ContractHistoryOptions } from '../../src/commands/development-tooling/contracts-command/contractHistory.types';

/**
 * Each state runs the real git binary in a temporary repository from withTempRepo, and calls the
 * three operations through a GitAdapter bound to that root, as readContractDiff and readContractLog
 * do. A row is [name, input, expected]: the call is recorded with its input and with what came back,
 * or the error class and message it threw, and the assertion compares that same outcome.
 */
export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

export type Result = { value: unknown } | { error: { type: string; message: string } };

export type Row<I> = [name: string, input: I, expected: Result];

export type Selectors = ContractHistoryOptions & { revisions?: string[] };
