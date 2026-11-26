/** A request's credentials are passed in here; a recorded case shows only its channel. */
export interface Call {
	method: string;
	path: string;
	origin: string | null;
	bearer?: string;
	cookie?: string;
}

export type Outcome = { output: unknown } | { error: string };

export type Example = { name: string; call: Call; expected: Outcome };
