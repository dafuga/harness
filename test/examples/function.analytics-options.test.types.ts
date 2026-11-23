import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * analyticsOptions is called on a subcommand the way the CLI registers response-check and audit:
 * on program.command(name), with the command's own options chained after the five. Each case
 * records what the call was given and what came back, or the refusal commander gave when the
 * command was parsed. The function reads no file, so no temporary directory is needed. Exits are
 * thrown and output is discarded, so a refused parse neither exits the process nor prints.
 */
export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
