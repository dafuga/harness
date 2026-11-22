// @harness-uid u_rtalczfelr

/** JSON.stringify input; nested undefined is allowed, top-level undefined throws. */
export type FingerprintValue =
	| string
	| number
	| boolean
	| null
	| readonly (FingerprintValue | undefined)[]
	| { [key: string]: FingerprintValue | undefined };
