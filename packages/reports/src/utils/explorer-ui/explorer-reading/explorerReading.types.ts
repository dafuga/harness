// @harness-uid u_tifhg2ffwr
export type Fields = Record<string, unknown>;

/** What a read result holds to compare: its parsed JSON value, or its text when it is not JSON. */
export type ArtifactValue =
	| null
	| boolean
	| number
	| string
	| ArtifactValue[]
	| { [key: string]: ArtifactValue };
