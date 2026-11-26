export type Outcome =
	| { output: unknown }
	| { error: { name: string; code: unknown; message: string } };
