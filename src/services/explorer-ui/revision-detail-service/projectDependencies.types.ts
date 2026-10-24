export interface ProjectDependency {
	name: string;
	version: string;
	kind: 'runtime' | 'development' | 'peer' | 'optional' | 'build';
	ecosystem: 'npm' | 'cargo';
	workspace: string;
	source: string;
}

export interface ProjectDependencies {
	entries: ProjectDependency[];
	gaps: string[];
}
