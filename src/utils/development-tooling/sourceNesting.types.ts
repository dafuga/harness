export interface SourceNesting {
	/** Curly-brace depth before each character. */
	brace: Int32Array;
	/** Parenthesis and square-bracket depth before each character. */
	group: Int32Array;
}
