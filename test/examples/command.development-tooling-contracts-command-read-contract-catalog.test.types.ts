import type { summary } from './command.development-tooling-contracts-command-read-contract-catalog.test';

export type Summary = ReturnType<typeof summary>;

export type Refusal = { expected: boolean; name: string; code: string | null; message: string };

export type Outcome = { output: Summary; error?: never } | { error: Refusal; output?: never };
