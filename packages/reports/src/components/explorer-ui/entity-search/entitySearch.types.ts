/** An entry as a query reads it: every text in lower case, its id and name also in parts. */
export interface Read {
	name: string;
	id: string;
	parts: string[];
	words: string[];
	purpose: string;
	terms: string[];
}
