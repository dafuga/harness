// @harness-uid u_nfctcgnv7g
export interface VideoOwner {
	id: string;
	uid?: string;
	status: string;
	owns: { source: string[] };
	dependencies: { unit: string }[];
	runtime?: { entry?: string; targets?: { entry?: string }[] };
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
export interface ClipInputContext {
	root: string;
	paths: Set<string>;
	owners: Map<string, VideoOwner>;
	sourceOwners: Map<string, string[]>;
	contents: Map<string, ClipInputFile>;
	references: Map<string, { paths: string[]; reasons: string[] }>;
	closures: Map<string, ClipInputClosure>;
	tool: string;
	packages?: Map<string, string>;
}
