export interface ModuleTaskDependencyBaseAdapterConfig {
	name?: string;
}
export interface ModuleTaskDependencyBaseDependencies {
	validateMetadata?: (root: string, commit: string) => Promise<void>;
}
export interface ModuleTaskDependencyBaseInput {
	sourceCommit: string;
	checkpoints: string[];
}
