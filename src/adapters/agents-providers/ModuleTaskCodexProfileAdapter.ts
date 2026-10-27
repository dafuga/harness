import { lstat, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { ModuleTaskSandboxAdapter } from './ModuleTaskSandboxAdapter';
import { ModuleTaskSandboxProcessAdapter } from './ModuleTaskSandboxProcessAdapter';
import type { ModuleTaskSandboxInput, SandboxProcess } from './ModuleTaskSandboxAdapter.types';
import type { ModuleTaskCodexProfileAdapterConfig } from './ModuleTaskCodexProfileAdapter.types';

export class ModuleTaskCodexProfileAdapter {
	constructor(private readonly config: ModuleTaskCodexProfileAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-codex-profile';
	}

	async prepare(input: ModuleTaskSandboxInput): Promise<SandboxProcess> {
		if ((this.config.platform ?? process.platform) !== 'darwin')
			throw new Error('Native Codex task profiles require verified macOS isolation.');
		const args = admittedArguments(input.argv);
		await rejectProjectPolicy(input.cwd);
		const executable = await trustedExecutable(input.argv[0], this.config.resolveExecutable);
		const runtime = dirname(executable).endsWith(`${sep}bin`)
			? dirname(dirname(executable))
			: dirname(executable);
		const readPaths = [...new Set([...input.readPaths, runtime])];
		assertGrants(input, readPaths, runtime);
		await validateReadGrants([...readPaths, input.snapshot]);
		const validated = await new ModuleTaskSandboxAdapter().prepare({
			...input,
			argv: [executable, 'exec', ...args],
			readPaths
		});
		try {
			return processProfile(executable, args, validated, configuration(input, readPaths));
		} catch (error) {
			await validated.cleanup();
			throw error;
		}
	}
}

export type { ModuleTaskCodexProfileAdapterConfig } from './ModuleTaskCodexProfileAdapter.types';

function processProfile(
	command: string,
	args: string[],
	validated: SandboxProcess,
	profile: Record<string, unknown>
): SandboxProcess {
	return {
		command,
		args: [
			'exec',
			'--ignore-user-config',
			'--strict-config',
			'--ephemeral',
			'-C',
			validated.cwd,
			...Object.entries(profile).flatMap(([key, value]) => ['-c', `${key}=${toml(value)}`]),
			...args
		],
		cwd: validated.cwd,
		env: validated.env,
		cleanup: validated.cleanup
	};
}

function admittedArguments(argv: string[]): string[] {
	if (basename(argv[0] ?? '') !== 'codex' || argv[1] !== 'exec')
		throw new Error('Expected explicit Codex exec arguments.');
	const result: string[] = [];
	for (let index = 2; index < argv.length; index++) {
		const admitted = admittedArgument(argv, index);
		result.push(...admitted.values);
		index = admitted.index;
	}
	return result;
}

function admittedArgument(argv: string[], index: number): { values: string[]; index: number } {
	const argument = argv[index];
	if (['--json', '--ephemeral', '--skip-git-repo-check'].includes(argument))
		return { values: [argument], index };
	if (['-m', '--model', '-c', '--config'].includes(argument))
		return { values: [argument, admittedValue(argument, argv[index + 1])], index: index + 1 };
	if (index === argv.length - 1 && (argument === '-' || !argument.startsWith('-')))
		return { values: [argument], index };
	throw new Error('Unsupported Codex task argument.');
}

function admittedValue(argument: string, value: string | undefined): string {
	if (!value || value.startsWith('-')) throw new Error('Missing Codex option value.');
	if (
		(argument === '-c' || argument === '--config') &&
		!/^\s*(model_reasoning_effort\s*=\s*"(?:low|medium|high|xhigh|max|ultra)"|approval_policy\s*=\s*"never")\s*$/.test(
			value
		)
	)
		throw new Error('Untrusted Codex configuration override.');
	return value;
}

async function trustedExecutable(
	command: string,
	resolver?: ModuleTaskCodexProfileAdapterConfig['resolveExecutable']
) {
	const selected = resolver ? await resolver(command) : Bun.which(command);
	if (!selected || !isAbsolute(selected)) throw new Error('Codex executable is unavailable.');
	const executable = await realpath(selected);
	if (
		!resolver &&
		!executable.endsWith(
			'/.codex/packages/standalone/releases/0.154.0-aarch64-apple-darwin/bin/codex'
		)
	)
		throw new Error('Codex runtime has not been qualified for native task profiles.');
	const info = await lstat(executable);
	const safe = [info.isFile(), info.nlink === 1, Boolean(info.mode & 0o111), !(info.mode & 0o022)];
	if (!safe.every(Boolean))
		throw new Error('Codex executable is not a trusted regular executable.');
	if (basename(executable) !== 'codex') throw new Error('Unexpected Codex executable.');
	return executable;
}

async function exists(path: string): Promise<boolean> {
	try {
		await lstat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function rejectProjectPolicy(cwd: string): Promise<void> {
	for (let directory = resolve(cwd); directory !== homedir(); directory = dirname(directory)) {
		if (
			(await exists(join(directory, '.codex', 'config.toml'))) ||
			(await exists(join(directory, '.codex', 'rules')))
		)
			throw new Error('Project Codex policy cannot be faithfully loaded from a neutral task cwd.');
		if ((await exists(join(directory, '.git'))) || dirname(directory) === directory) return;
	}
}

function contains(parent: string, child: string): boolean {
	return child === parent || child.startsWith(parent.endsWith(sep) ? parent : `${parent}${sep}`);
}

function assertGrants(input: ModuleTaskSandboxInput, reads: string[], runtime: string): void {
	const sensitive =
		/(^|\/)(\.env(?:\.[^/]*)?|auth\.json|credentials(?:\.[^/]*)?|config\.toml|\.ssh|\.aws|\.gnupg|\.config|\.claude)(\/|$)/i;
	const grants = [
		...reads,
		input.snapshot,
		input.scratch,
		...input.files.map((file) => resolve(input.cwd, file))
	];
	for (const path of grants) {
		if (
			sensitive.test(path) ||
			contains(path, homedir()) ||
			(/(^|\/)\.codex(\/|$)/.test(path) && !contains(runtime, path) && !contains(input.cwd, path))
		)
			throw new Error('Credential or configuration paths cannot be task grants.');
		if (
			input.protectedPaths.some(
				(protectedPath) => contains(path, protectedPath) || contains(protectedPath, path)
			)
		)
			throw new Error('Task grant overlaps a protected path.');
	}
	if (input.exactReadDirectories?.length)
		throw new Error('Exact-directory-only native Codex grants have not been verified.');
}

async function validateReadGrants(paths: string[]): Promise<void> {
	const guard = new ModuleTaskSandboxProcessAdapter();
	for (const path of paths) {
		if ((await realpath(path)) !== path) throw new Error('Noncanonical Codex read grant.');
		await guard.validateScratch(path);
	}
}

function configuration(input: ModuleTaskSandboxInput, reads: string[]): Record<string, unknown> {
	const filesystem: Record<string, string> = { ':root': 'deny', ':minimal': 'read' };
	for (const path of [...reads, input.snapshot]) filesystem[path] = 'read';
	filesystem[input.scratch] = 'write';
	for (const file of input.files) filesystem[resolve(input.cwd, file)] = 'write';
	for (const path of input.protectedPaths) filesystem[path] = 'deny';
	const environment: Record<string, string> = { TMPDIR: input.scratch };
	if (input.binDirectory) environment.PATH = `${input.binDirectory}:/usr/bin:/bin:/usr/sbin:/sbin`;
	return {
		approval_policy: 'never',
		default_permissions: 'harness-task',
		'permissions.harness-task.filesystem': filesystem,
		'permissions.harness-task.network.enabled': false,
		'shell_environment_policy.inherit': 'none',
		'shell_environment_policy.experimental_use_profile': false,
		'shell_environment_policy.set': environment,
		'features.apps': false,
		'features.plugins': false,
		'features.multi_agent': false,
		web_search: 'disabled'
	};
}

function toml(value: unknown): string {
	if (value !== null && typeof value === 'object')
		return `{${Object.entries(value)
			.map(([key, entry]) => `${JSON.stringify(key)}=${toml(entry)}`)
			.join(',')}}`;
	const encoded = JSON.stringify(value);
	if (encoded === undefined) throw new Error('Unsupported native profile value.');
	return encoded;
}
