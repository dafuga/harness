export type Validate = (input: unknown) => unknown;

export type Case = { name: string; input: unknown } & ({ output: unknown } | { error: string });
