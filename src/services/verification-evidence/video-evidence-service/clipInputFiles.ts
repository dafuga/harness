// @harness-uid u_nfctcgnv7g
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join, relative, sep, posix } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ExpectedCliError } from '../../../core/development-tooling/errors';
import type { ClipInputContext, ClipInputFile, VideoOwner } from './clipInputs.types';

/** One immutable discovery/cache scope for a synchronous plan. */
export function createClipInputContext(root: string): ClipInputContext {
	const context: ClipInputContext = {
		root: realpathSync(root),
		paths: inventory(root),
		owners: new Map(),
		sourceOwners: new Map(),
		contents: new Map(),
		references: new Map(),
		closures: new Map(),
		tool: ''
	};
	for (const path of [...context.paths].filter((path) =>
		/^specification\/units\/[^/]+\.json$/.test(path)
	)) {
		const owner = JSON.parse(readClipInput(context, path).text) as VideoOwner;
		if (!owner.id || !Array.isArray(owner.owns?.source) || !Array.isArray(owner.dependencies))
			throw new ExpectedCliError(`Invalid video owner binding ${path}`);
		if (context.owners.has(owner.id))
			throw new ExpectedCliError(`Duplicate video owner ${owner.id}`);
		context.owners.set(owner.id, owner);
		for (const source of owner.owns.source)
			context.sourceOwners.set(source, [...(context.sourceOwners.get(source) ?? []), owner.id]);
	}
	const tool = spawnSync('ffmpeg', ['-version'], {
		timeout: 5000,
		maxBuffer: 32_768,
		encoding: 'utf8'
	});
	if (tool.status !== 0) throw new ExpectedCliError('Missing ffmpeg recording toolchain');
	context.tool = tool.stdout;
	return context;
}

export function readClipInput(context: ClipInputContext, path: string): ClipInputFile {
	assertSafePath(path);
	const absolute = join(context.root, path);
	if (!existsSync(absolute)) throw new ExpectedCliError(`Missing video input ${path}`);
	const resolved = realpathSync(absolute),
		bound = relative(context.root, resolved);
	if (bound === '..' || bound.startsWith(`..${sep}`))
		throw new ExpectedCliError(`Video input escapes source root: ${path}`);
	if (!statSync(resolved).isFile())
		throw new ExpectedCliError(`Video input is not a file: ${path}`);
	let input = context.contents.get(resolved);
	if (!input) {
		const bytes = readFileSync(resolved);
		input = { sha256: clipDigest(bytes), text: textualInput(path) ? bytes.toString('utf8') : '' };
		context.contents.set(resolved, input);
	}
	return input;
}

export function clipDigest(input: string | Buffer): string {
	return createHash('sha256').update(input).digest('hex');
}

export function clipWorkspace(context: ClipInputContext, path: string): string {
	let directory = posix.dirname(path);
	while (directory !== '.') {
		if (context.paths.has(`${directory}/package.json`)) return directory;
		directory = posix.dirname(directory);
	}
	return '';
}

function inventory(root: string): Set<string> {
	const repository = spawnSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], {
		encoding: 'utf8',
		timeout: 5000,
		maxBuffer: 32768
	});
	if (repository.status === 0 && realpathSync(repository.stdout.trim()) === realpathSync(root)) {
		const tracked = spawnSync('git', ['-C', root, 'ls-files', '--cached', '-z'], {
			encoding: 'utf8',
			timeout: 5000,
			maxBuffer: 16 * 1024 * 1024
		});
		if (tracked.status !== 0)
			throw new ExpectedCliError('Cannot enumerate tracked video source inputs');
		return new Set(tracked.stdout.split('\0').filter(Boolean));
	}
	return archiveInventory(root);
}

/** Clean Git archives have no repository; inspect them before setup creates any output. */
function archiveInventory(root: string): Set<string> {
	const paths = new Set<string>(),
		pending = [''];
	const ignored = new Set([
		'.git',
		'.cache',
		'node_modules',
		'dist',
		'build',
		'output',
		'.svelte-kit',
		'coverage'
	]);
	while (pending.length) {
		const directory = pending.pop()!;
		for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
			if (ignored.has(entry.name) || /^\.env(?:\.|$)/.test(entry.name)) continue;
			const path = posix.join(directory, entry.name);
			if (entry.isDirectory()) pending.push(path);
			else paths.add(path);
		}
	}
	return paths;
}

function textualInput(path: string): boolean {
	return /\.(?:[cm]?[jt]sx?|svelte|css|json|html|svg|md|toml|ya?ml|lock|txt|gql|sql|sh|py|rs|gitignore)$/.test(
		path
	);
}

function assertSafePath(path: string): void {
	if (
		!path ||
		posix.isAbsolute(path) ||
		path.includes('\\') ||
		path.includes(':') ||
		path.split('/').some((part) => !part || part === '.' || part === '..')
	)
		throw new ExpectedCliError(`Unsafe video input ${path}`);
}
