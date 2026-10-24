export interface ProjectDependency {
	name: string;
	version: string;
	kind: 'runtime' | 'development' | 'peer' | 'optional' | 'build';
	ecosystem: 'npm' | 'cargo';
	workspace: string;
	source: string;
	condition?: string;
}

/** Direct declarations from committed manifests, never installed or inferred packages. */
export interface ProjectDependencies {
	entries: ProjectDependency[];
	gaps: string[];
}

export interface DependencyManifest {
	manifest: Record<string, unknown>;
	source: string;
	npm: boolean;
	inherited: Record<string, unknown>;
}
export interface DependencySection {
	value: Record<string, unknown>;
	condition: string;
}
