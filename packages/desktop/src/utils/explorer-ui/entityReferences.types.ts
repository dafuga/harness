/** A piece of agent text: words as written, or a reference to a unit by its registered id. */
export type ReferencePart =
	| { kind: 'text'; text: string }
	| { kind: 'reference'; id: string; text: string };
