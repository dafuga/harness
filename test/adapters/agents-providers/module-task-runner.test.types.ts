import type { ModuleTaskRunnerAdapter } from '../../../src/adapters/agents-providers/ModuleTaskRunnerAdapter';

export type RunnerScopeFixture = {
	files: string[];
	snapshot: string;
	scratch: string;
	readPaths: string[];
	protectedPaths: string[];
};
export type RunnerInputFixture = {
	provider: 'claude' | 'codex';
	model: string;
	intelligence: string;
	cwd: string;
	prompt: string;
	signal: AbortSignal;
	scope?: RunnerScopeFixture;
};
export type SandboxPrepareFixture = RunnerScopeFixture & { cwd: string; argv: string[] };
export type SandboxProcessFixture = {
	command: string;
	args: string[];
	cwd: string;
	env: NodeJS.ProcessEnv;
	cleanup(): Promise<void>;
};
export type RunnerExecuteFixture = (
	argv: string[],
	input: { cwd: string; env: NodeJS.ProcessEnv; signal: AbortSignal }
) => Promise<{ code: number; stdout: string; stderr?: string }>;
export type RunnerSandboxFixture = {
	prepare(input: SandboxPrepareFixture): Promise<SandboxProcessFixture>;
};
export type RunnerConstructorFixture = new (
	execute?: RunnerExecuteFixture,
	sandbox?: RunnerSandboxFixture
) => ModuleTaskRunnerAdapter;
