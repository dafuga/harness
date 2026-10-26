export type SandboxRequest = {
	cwd: string;
	argv: string[];
	files: string[];
	snapshot: string;
	scratch: string;
	readPaths: string[];
	protectedPaths: string[];
	exactReadDirectories?: string[];
};
export type SandboxProcess = {
	command: string;
	args: string[];
	cwd: string;
	env: NodeJS.ProcessEnv;
	cleanup(): Promise<void>;
};
