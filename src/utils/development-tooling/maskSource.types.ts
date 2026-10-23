export interface MaskOptions {
	/** Blank string, template and regular-expression contents as well as comments. */
	strings?: boolean;
}

export interface Cursor {
	code: string;
	out: string[];
	index: number;
	strings: boolean;
	significant: string;
	word: string;
}
