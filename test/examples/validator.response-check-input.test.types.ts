export type Recorded =
	| { name: string; input: unknown; output: unknown }
	| { name: string; input: unknown; error: unknown };
