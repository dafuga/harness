// @harness-uid u_gndb6l2t6f
/** A static dictionary row and its verified runtime callers at one source revision. */
export interface TranslationRow {
	scope: string;
	key: string;
	values: Record<string, string>;
	sources: string[];
	usedBy: string[];
}

/** Languages and dictionaries read from the selected commit, never from the serving build. */
export interface TranslationCatalog {
	locales: string[];
	rows: TranslationRow[];
	gaps: string[];
}
