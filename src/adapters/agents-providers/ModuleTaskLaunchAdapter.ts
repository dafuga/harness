import { constants } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';
import { basename, delimiter, extname, isAbsolute, join, sep } from 'node:path';
import { ModuleTaskProviderConfigAdapter } from './ModuleTaskProviderConfigAdapter';
import type { TaskProcessResult } from './ModuleTaskRunnerAdapter.types';
import type {
	ModuleTaskLaunchAdapterConfig,
	ModuleTaskLaunchExecute,
	ModuleTaskLaunchInput,
	ModuleTaskLaunchProvider,
	ModuleTaskLaunchSandbox
} from './ModuleTaskLaunchAdapter.types';
import type { ModuleTaskSandboxAdapter } from './ModuleTaskSandboxAdapter';

const packagePaths: Record<ModuleTaskLaunchProvider, string> = {
	claude: 'node_modules/@anthropic-ai/claude-code',
	codex: 'node_modules/@openai/codex'
};

const PRELAUNCH_MESSAGE = 'Provider launch was blocked before execution.';

export class ModuleTaskLaunchAdapter {
	constructor(private readonly config: ModuleTaskLaunchAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-launch';
	}

	async qualify(): Promise<void> {
		try {
			if (!this.config.qualification) throw prelaunchFailure();
			await this.config.qualification();
		} catch {
			throw prelaunchFailure();
		}
	}

	async run(
		argv: string[],
		input: ModuleTaskLaunchInput,
		execute: ModuleTaskLaunchExecute,
		sandbox: ModuleTaskLaunchSandbox
	): Promise<TaskProcessResult> {
		await this.qualify();
		return runProvider(argv, input, execute, sandbox);
	}
}

async function runProvider(
	argv: string[],
	input: ModuleTaskLaunchInput,
	execute: ModuleTaskLaunchExecute,
	sandbox: ModuleTaskLaunchSandbox
): Promise<TaskProcessResult> {
	const scope = input.scope;
	if (!scope) throw prelaunchFailure();
	let process: Awaited<ReturnType<ModuleTaskSandboxAdapter['prepare']>>;
	try {
		const contextPaths = [input.cwd, scope.snapshot, scope.scratch];
		if (contextPaths.some((path) => !isAbsolute(path)))
			throw new Error('Context paths must be absolute.');
		const readPaths = await providerReadPaths(input.provider, argv[0], scope.binDirectory);
		const providerConfig = await new ModuleTaskProviderConfigAdapter().paths(input.provider);
		process = await sandbox.prepare({
			cwd: input.cwd,
			files: [...scope.files],
			snapshot: scope.snapshot,
			scratch: scope.scratch,
			readPaths: [...new Set([...scope.readPaths, ...readPaths, ...providerConfig.readPaths])],
			exactReadDirectories: providerConfig.exactReadDirectories,
			protectedPaths: [...scope.protectedPaths],
			argv: [...argv],
			...(scope.binDirectory ? { binDirectory: scope.binDirectory } : {})
		});
	} catch {
		throw prelaunchFailure();
	}
	let executionFailed = false;
	try {
		return await execute([process.command, ...process.args], {
			...input,
			cwd: process.cwd,
			env: process.env
		});
	} catch (error) {
		executionFailed = true;
		throw error;
	} finally {
		if (executionFailed) await process.cleanup().catch(() => undefined);
		else await process.cleanup();
	}
}

async function providerReadPaths(
	provider: ModuleTaskLaunchProvider,
	command: string | undefined,
	binDirectory: string | undefined
): Promise<string[]> {
	if (!command || basename(command) !== provider) throw new Error('Invalid provider command.');
	const pathValue = process.env.PATH ?? '';
	const search = [binDirectory, ...pathValue.split(delimiter)];
	const executable = await findExecutable(command, search);
	if (!executable) throw new Error('Provider executable is unavailable.');
	const paths = [executable];
	const packageRoot = await officialPackageRoot(executable, provider);
	if (packageRoot) {
		paths.push(packageRoot);
		const runtimes = await Promise.all(['node', 'bun'].map((name) => findExecutable(name, search)));
		paths.push(...runtimes.filter((path): path is string => path !== undefined));
		if (!runtimes.some(Boolean)) throw new Error('Provider runtime is unavailable.');
	}
	return [...new Set(paths)];
}

async function findExecutable(
	command: string,
	search: Array<string | undefined>
): Promise<string | undefined> {
	let candidates: string[] = [];
	if (isAbsolute(command)) candidates = [command];
	else if (!command.includes(sep))
		candidates = search
			.filter((dir): dir is string => Boolean(dir && isAbsolute(dir)))
			.map((dir) => join(dir, command));
	for (const candidate of candidates) {
		try {
			const canonical = await realpath(candidate);
			const info = await stat(canonical);
			if (!info.isFile()) continue;
			await access(canonical, constants.X_OK);
			return canonical;
		} catch {
			continue;
		}
	}
	return undefined;
}

async function officialPackageRoot(
	executable: string,
	provider: ModuleTaskLaunchProvider
): Promise<string | undefined> {
	const marker = `${sep}${packagePaths[provider].split('/').join(sep)}${sep}`;
	const index = executable.lastIndexOf(marker);
	if (index < 0) {
		if (['.js', '.mjs', '.cjs'].includes(extname(executable)))
			throw new Error('Provider script is not in an official package.');
		return undefined;
	}
	const canonical = await realpath(executable.slice(0, index + marker.length - 1));
	const info = await stat(canonical);
	return info.isDirectory() ? canonical : undefined;
}

function prelaunchFailure(): Error {
	return Object.assign(new Error(PRELAUNCH_MESSAGE), {
		quotaRejected: false,
		diagnostic: {
			category: 'permission',
			phase: 'prelaunch',
			nextAction: 'Verify the provider CLI and trusted runtime, then retry.'
		}
	});
}

export type { ModuleTaskLaunchAdapterConfig } from './ModuleTaskLaunchAdapter.types';
