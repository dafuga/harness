import { lstat, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { ModuleTaskSandboxProcessAdapter } from './ModuleTaskSandboxProcessAdapter';
import type {
	ModuleTaskSandboxAdapterConfig,
	ModuleTaskSandboxInput,
	SandboxProcess
} from './ModuleTaskSandboxAdapter.types';

export class ModuleTaskSandboxAdapter {
	constructor(private readonly config: ModuleTaskSandboxAdapterConfig = {}) {}

	connect(): string {
		return this.config.name ?? 'module-task-sandbox';
	}

	async prepare(input: ModuleTaskSandboxInput): Promise<SandboxProcess> {
		if (process.platform !== 'darwin') {
			throw new Error('Harness task sandbox is unavailable on this platform; refusing to launch.');
		}
		const scope = await canonicalScope(input);
		const processAdapter = new ModuleTaskSandboxProcessAdapter();
		await processAdapter.validateScratch(input.scratch);
		const cli = createRequire(import.meta.url).resolve('@anthropic-ai/sandbox-runtime');
		const runtime = await realpath(cli);
		const directory = await mkdtemp('/tmp/harness-task-policy-');
		try {
			const settings = join(directory, 'settings.json');
			await writeFile(settings, JSON.stringify(sandboxSettings(scope)), { mode: 0o600 });
			return {
				command: process.execPath,
				args: processAdapter.command(runtime, settings, processAdapter.arguments(scope)).slice(1),
				cwd: directory,
				env: processAdapter.environment(scope, directory),
				cleanup: () => rm(directory, { recursive: true, force: true })
			};
		} catch (error) {
			await rm(directory, { recursive: true, force: true });
			throw error;
		}
	}
}

function beneath(path: string, parent: string): boolean {
	const value = relative(parent, path);
	return value === '' || (!value.startsWith('../') && value !== '..' && !isAbsolute(value));
}

async function canonicalFiles(cwd: string, files: string[]): Promise<string[]> {
	if (!files.length || files.length > 64 || new Set(files).size !== files.length) {
		throw new Error('Unsafe sandbox file grant: expected one to 64 distinct exact files.');
	}
	return Promise.all(
		files.map(async (file) => {
			const parts = file.split('/');
			if (
				isAbsolute(file) ||
				/[\\:*?]/.test(file) ||
				[...file].some(
					(character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
				) ||
				parts.some(
					(part) => !part || part === '.' || part === '..' || part.toLowerCase() === '.git'
				)
			)
				throw new Error('Unsafe sandbox file grant: noncanonical path.');
			let target = cwd;
			for (const part of parts) {
				target = join(target, part);
				if ((await lstat(target)).isSymbolicLink())
					throw new Error('Unsafe sandbox symlink grant.');
			}
			const stat = await lstat(target);
			if (!stat.isFile() || stat.nlink !== 1)
				throw new Error('Unsafe sandbox file grant: regular unlinked file required.');
			return target;
		})
	);
}

function validateScopeInput(input: ModuleTaskSandboxInput): void {
	if (
		![
			input.cwd,
			input.snapshot,
			input.scratch,
			...input.readPaths,
			...input.protectedPaths,
			...(input.exactReadDirectories ?? [])
		].every(isAbsolute)
	) {
		throw new Error('Unsafe sandbox context: absolute paths required.');
	}
	if (!input.argv.length || input.argv.some((value) => !value || value.includes('\0'))) {
		throw new Error('Invalid sandbox process arguments.');
	}
}

async function canonicalScope(input: ModuleTaskSandboxInput): Promise<ModuleTaskSandboxInput> {
	validateScopeInput(input);
	const cwd = await realpath(input.cwd);
	const files = await canonicalFiles(cwd, input.files);
	const snapshot = await realpath(input.snapshot);
	const scratch = await realpath(input.scratch);
	const readPaths = await Promise.all(input.readPaths.map((path) => realpath(path)));
	const exactReadDirectories = await Promise.all(
		(input.exactReadDirectories ?? []).map((path) => realpath(path))
	);
	const protectedPaths = await Promise.all(input.protectedPaths.map((path) => realpath(path)));
	if (!(await lstat(snapshot)).isFile() || !(await lstat(scratch)).isDirectory()) {
		throw new Error('Invalid sandbox snapshot or scratch directory.');
	}
	if (
		(await Promise.all(exactReadDirectories.map((path) => lstat(path)))).some(
			(stat) => !stat.isDirectory()
		)
	)
		throw new Error('Invalid exact read directory.');
	if (
		beneath(scratch, cwd) ||
		[cwd, snapshot, ...files, ...readPaths, ...exactReadDirectories, ...protectedPaths].some(
			(path) => beneath(path, scratch)
		) ||
		[...readPaths, ...exactReadDirectories].some(
			(path) => beneath(path, cwd) || [cwd, ...protectedPaths].some((root) => beneath(root, path))
		) ||
		exactReadDirectories.some((path) => beneath(scratch, path))
	)
		throw new Error('Unsafe overlapping sandbox runtime or scratch grant.');
	const scope = {
		...input,
		cwd,
		files,
		snapshot,
		scratch,
		readPaths,
		exactReadDirectories,
		protectedPaths
	};
	scope.binDirectory = await canonicalBin(input, readPaths);
	return scope;
}

async function canonicalBin(input: ModuleTaskSandboxInput, paths: string[]) {
	if (!input.binDirectory) return undefined;
	const bin = await realpath(input.binDirectory);
	if (
		!isAbsolute(input.binDirectory) ||
		!paths.includes(bin) ||
		!(await lstat(bin)).isDirectory()
	) {
		throw new Error('Untrusted Harness contract CLI directory.');
	}
	return bin;
}

function sandboxSettings(scope: ModuleTaskSandboxInput) {
	const literal = (path: string) => ({ path, literal: true });
	const patterns = scope.files.map(exactFilePattern);
	const reads = [exactFilePattern(scope.cwd), ...patterns];
	const aliases = reads.flatMap((pattern) =>
		pattern
			.split('/')
			.map((_part, index, parts) => parts.slice(0, index + 1).join('/'))
			.filter((path) => path.includes('['))
	);
	return {
		network: {
			allowedDomains:
				'api.anthropic.com platform.claude.com claude.ai api.openai.com chatgpt.com auth.openai.com'.split(
					' '
				),
			deniedDomains: ['localhost', '127.0.0.1', '[::1]'],
			strictAllowlist: true
		},
		filesystem: {
			denyRead: [
				...new Set([
					homedir(),
					tmpdir(),
					'/tmp',
					'/private/tmp',
					scope.cwd,
					...scope.protectedPaths,
					...aliases
				])
			].map(literal),
			allowRead: [
				...[scope.snapshot, scope.scratch, ...scope.readPaths].map(literal),
				...reads,
				...(scope.exactReadDirectories ?? []).map(exactFilePattern)
			],
			allowWrite: [...patterns, literal(scope.scratch)],
			denyWrite: [
				scope.snapshot,
				...scope.readPaths,
				...(scope.exactReadDirectories ?? []),
				join(homedir(), '.claude/debug'),
				join(homedir(), '.npm/_logs'),
				'/tmp/claude',
				'/private/tmp/claude',
				...aliases
			].map(literal)
		}
	};
}

function exactFilePattern(path: string): string {
	const chars = [...path];
	const index = chars.reduce((found, char, at) => (/[a-z0-9]/i.test(char) ? at : found), -1);
	if (index <= chars.lastIndexOf('/')) throw new Error('Unsupported exact sandbox file name.');
	return chars
		.map((char, at) => (at === index || '[*?'.includes(char) ? `[${char}]` : char))
		.join('');
}
export type { ModuleTaskSandboxAdapterConfig } from './ModuleTaskSandboxAdapter.types';
