import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * runAudit calls cleanCodeExitCode with the audit result and renderCleanCode with the clean-code
 * report. Each state calls the real export with its inputs and records what came back.
 */
export type Case = Parameters<typeof recordExampleCases>[1][number];
