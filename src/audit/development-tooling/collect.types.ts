export interface CollectedFile {
	path: string;
	extension: string;
}

export interface CollectedFiles {
	files: CollectedFile[];
	dirs: string[];
	ignoredPaths: string[];
}
