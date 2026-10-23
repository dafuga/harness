export interface ResolveContext {
	/** Every repository-relative path in the tree being indexed. */
	files: ReadonlySet<string>;
	/** Repository-relative root of the workspace that owns the importing file. */
	workspaceRoot: string;
}
