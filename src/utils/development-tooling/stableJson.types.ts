// @harness-uid u_ulnsle5cie
/** JavaScript values the formatter accepts before applying JSON serialization rules. */
export type StableJsonInput =
	| object
	| string
	| number
	| boolean
	| bigint
	| symbol
	| null
	| undefined;

export interface Position {
	indent: number;
	/** Characters already on the line before the value, plus a trailing comma when present. */
	reserved: number;
}
