import type { ModuleTaskSandboxAdapter } from '../../../src/adapters/agents-providers/ModuleTaskSandboxAdapter';

export type Fixture = {
	root: string;
	cwd: string;
	scratch: string;
	snapshot: string;
	paths: {
		assigned: string;
		sibling: string;
		source: string;
		test: string;
		git: string;
		commonGit: string;
		app: string;
		outside: string;
		bunfig: string;
		preload: string;
		scratchHardlink: string;
		link: string;
		hardlink: string;
		directory: string;
		created: string;
		renamed: string;
		escape: string;
		rulesDirectory: string;
		rulesFile: string;
		siblingMdc: string;
		foreignRule: string;
	};
};

export type SandboxProcess = Awaited<ReturnType<ModuleTaskSandboxAdapter['prepare']>>;
