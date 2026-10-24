export type Guess = { value: unknown } | undefined;

/** One example of a field, with the exact text it is shown as. */
export interface ContractExample {
	/** A literal is one JSON value; markup is shown as written; a structure is read as fields. */
	form: 'literal' | 'markup' | 'structure';
	value: unknown;
	text: string;
}

/** One input, output or error as a person reads it. */
export interface ContractField {
	/** Readable component field name or the exact callable parameter identifier. */
	name: string;
	/** The public type as declared, without the module an inferred type is imported from. */
	type: string;
	description?: string;
	/**
	 * `declared` when the contract records examples; `illustrative` when it records none and the
	 * type is plain data a placeholder can show; `missing` when it is neither.
	 */
	source: 'declared' | 'illustrative' | 'missing';
	examples: ContractExample[];
}

export interface ContractGroup {
	id: 'inputs' | 'outputs' | 'errors' | `type-${number}`;
	title: string;
	/** Some error tables show only type and example; parameter and return tables keep names. */
	hideNames?: boolean;
	/** Keep an empty API table with an explicit absence message. */
	keepEmpty?: boolean;
	/** What is said when the contract declares none. */
	none: string;
	fields: ContractField[];
}
