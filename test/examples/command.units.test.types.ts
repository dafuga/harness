import type { recordExampleCases } from '../support/recordExampleCases';

/**
 * registerUnitsCommand is called on a program the way buildProgram calls it. A state either
 * dispatches argv through commander, so an action runs only when commander reaches it, or runs an
 * action that reads the registry from the working directory. Those states change into a fresh Git
 * repository and change back before they assert or record, so nothing outside it is written.
 */
export type Schema = { type: string; required: string[]; properties: Record<string, unknown> };

export type Subcommand = [name: string, args: string[], options: string[]];

export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];
