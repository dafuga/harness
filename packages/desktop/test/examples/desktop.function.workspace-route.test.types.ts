import type { workspacePath } from '../../src/utils/workspaceRoute';

export type Outcome =
	| { output: unknown; error?: never }
	| { error: { name: string; message: string }; output?: never };

export type Case = { name: string; input: unknown } & Outcome;

export type Target = Parameters<typeof workspacePath>[0];
