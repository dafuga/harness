export type ExampleCase = { name: string; input: unknown } & (
	| { output: unknown }
	| { error: unknown }
);
