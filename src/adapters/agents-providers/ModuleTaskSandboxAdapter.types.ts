export interface ModuleTaskSandboxAdapterConfig {
	name?: string;
}

export interface ModuleTaskSandboxInput {
	binDirectory?: string;
	cwd: string;
	files: string[];
	snapshot: string;
	scratch: string;
	readPaths: string[];
	exactReadDirectories?: string[];
	protectedPaths: string[];
	argv: string[];
}

export interface SandboxProcess {
	command: string;
	args: string[];
	cwd: string;
	env: Record<string, string | undefined>;
	cleanup(): Promise<void>;
}
