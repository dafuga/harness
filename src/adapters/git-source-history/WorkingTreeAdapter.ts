import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { collectAuditedFiles } from '../../audit/development-tooling/collect';
import type { SourceTree, TreeEntry } from '../../core/development-tooling/sourceTypes';
import { GitAdapter } from './GitAdapter';

/** Reads the files currently on disk, honoring git ignore rules when git is available. */
export class WorkingTreeAdapter implements SourceTree {
	readonly revision = 'working-tree';
	private readonly git: GitAdapter;
	private listed: Promise<TreeEntry[]> | undefined;

	constructor(private readonly root: string) {
		this.git = new GitAdapter(root);
	}

	list(): Promise<TreeEntry[]> {
		this.listed ??= this.scan();
		return this.listed;
	}

	private async scan(): Promise<TreeEntry[]> {
		const paths = (await this.git.isRepository())
			? await this.tracked()
			: ((await snapshotPaths(this.root)) ?? (await this.walked()));
		const entries = await Promise.all(paths.map((path) => this.entry(path)));
		return entries
			.filter((entry): entry is TreeEntry => entry !== undefined)
			.sort((left, right) => (left.path < right.path ? -1 : 1));
	}

	read(path: string): Promise<string> {
		return readFile(join(this.root, path), 'utf8');
	}

	private async tracked(): Promise<string[]> {
		const output = await this.git.run(['ls-files', '-co', '--exclude-standard', '-z']);
		return [...new Set(output.split('\0').filter(Boolean))];
	}

	private async walked(): Promise<string[]> {
		const collected = await collectAuditedFiles(this.root);
		return collected.files.map((file) => relative(this.root, file.path).replaceAll('\\', '/'));
	}

	/** Hashes like `git hash-object` so working files and commit blobs share one identity. */
	private async entry(path: string): Promise<TreeEntry | undefined> {
		try {
			const bytes = await readFile(join(this.root, path));
			const hash = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
			return { path, hash };
		} catch {
			return undefined;
		}
	}
}

/** Snapshot inventories name only files actually exported from their committed tree. */
async function snapshotPaths(root: string): Promise<string[] | undefined> {
	const target = await realpath(root).catch(() => resolve(root));
	let directory = target;
	while (true) {
		if (basename(directory).startsWith('harness-snapshot-'))
			return readSnapshotPaths(directory, target);
		const parent = dirname(directory);
		if (parent === directory) return undefined;
		directory = parent;
	}
}

async function readSnapshotPaths(directory: string, target: string): Promise<string[]> {
	let data: unknown;
	try {
		data = JSON.parse(await readFile(`${directory}.tracked.json`, 'utf8'));
	} catch {
		throw new Error('Snapshot source inventory is unavailable or invalid.');
	}
	if (!validSnapshotInventory(data) || (await realpath(data.root).catch(() => '')) !== directory)
		throw new Error('Snapshot source inventory is invalid.');
	const prefix = relative(directory, target).replaceAll('\\', '/');
	return prefix
		? data.files
				.filter((path) => path.startsWith(`${prefix}/`))
				.map((path) => path.slice(prefix.length + 1))
		: data.files;
}

function validSnapshotInventory(
	data: unknown
): data is { root: string; revision: string; version: 1; files: string[] } {
	if (!data || typeof data !== 'object') return false;
	const found = data as { version?: unknown; root?: unknown; revision?: unknown; files?: unknown };
	return (
		found.version === 1 &&
		typeof found.root === 'string' &&
		typeof found.revision === 'string' &&
		/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(found.revision) &&
		Array.isArray(found.files) &&
		found.files.every(safeSnapshotPath) &&
		new Set(found.files).size === found.files.length
	);
}

function safeSnapshotPath(path: unknown): path is string {
	return (
		typeof path === 'string' &&
		!isAbsolute(path) &&
		!path.includes('\\') &&
		!path.includes('\0') &&
		path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
	);
}
