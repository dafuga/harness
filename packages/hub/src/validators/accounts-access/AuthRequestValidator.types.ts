// @harness-uid u_le3fi5uzvj
export type Body = Record<string, unknown>;
export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };
