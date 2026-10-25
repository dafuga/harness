export interface ModulePathConflict {
	ours: string;
	theirs: string;
	path: string;
	held: string;
	blob: string;
	base?: string;
}
