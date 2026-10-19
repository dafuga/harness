

export interface IndexFile {
	/** Path inside the history index: `index.json`, `revisions/<commit>.json` or `media/<name>`. */
	path: string;
	bytes: Uint8Array;
}

export interface BundledSize {
	files: number;
	bytes: number;
	/** What the modules weigh compressed, which is how a Worker script is limited. */
	compressedBytes: number;
}

export { consoleDataModules, bundledSize } from '../services/console-install-service/consoleDataModules';
