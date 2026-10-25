export interface ModuleDataIdentity {
	commit: string;
	tree: string;
	inputs: { notes: string | null; evidence: string | null };
}
