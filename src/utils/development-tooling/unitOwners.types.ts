/** What one unit says it owns: files, or directories written with a closing slash. */
export interface OwnedSource {
	id: string;
	source: string[];
}
