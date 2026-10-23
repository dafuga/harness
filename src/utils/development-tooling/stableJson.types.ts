export interface Position {
	indent: number;
	/** Characters already on the line before the value, plus a trailing comma when present. */
	reserved: number;
}
