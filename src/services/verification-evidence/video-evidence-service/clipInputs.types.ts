// @harness-uid u_nfctcgnv7g
export interface VideoOwner {
	id: string;
	uid?: string;
	status: string;
	owns: { source: string[] };
	dependencies: { unit: string }[];
	runtime?: { kind?: string; entry?: string; targets?: { kind?: string; entry?: string }[] };
}

export interface ClipInputFile {
	sha256: string;
	text: string;
}
export interface ClipInputClosure {
	files: Set<string>;
	contracts: Map<string, VideoOwner>;
	reasons: Set<string>;
}
export interface ClipInputReferences {
	paths: string[];
	reasons: string[];
}

export interface ClipStyleInputs {
	css: string;
	markup: string;
	reasons: string[];
}

export interface ClipInputContext {
	root: string;
	paths: Set<string>;
	owners: Map<string, VideoOwner>;
	sourceOwners: Map<string, string[]>;
	contents: Map<string, ClipInputFile>;
	references: Map<string, ClipInputReferences>;
	configurations?: Map<string, ClipInputReferences>;
	closures: Map<string, ClipInputClosure>;
	tool: string;
	packages?: Map<string, string>;
	generatedVersions?: Map<string, string>;
}
