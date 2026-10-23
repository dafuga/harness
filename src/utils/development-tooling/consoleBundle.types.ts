export type Loader = () => Promise<unknown>;

export interface ConsoleModules {
	/** Loaders of modules whose default export is the JSON text of one data file. */
	json: Record<string, Loader>;
	/** Loaders of modules whose default export is base64 media and whose `type` is its MIME type. */
	media: Record<string, Loader>;
}
