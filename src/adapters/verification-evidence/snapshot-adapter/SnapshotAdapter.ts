// @harness-uid u_l3f5bpp55y
import type { RetainedArtifact, SnapshotDrift } from './SnapshotAdapter.types';
import { TarExtractError } from './SnapshotAdapter.types';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, existsSync } from 'node:fs';
import type { Stats } from 'node:fs';
import { mkdir, mkdtemp, lstat, open, readFile, readlink, rm, symlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { TreeEntry } from '../../../core/development-tooling/sourceTypes';
import { pathMatches } from '../../../core/development-tooling/unitsConfig';
import { declaredOutput, snapshotAdditions } from './snapshotAdditions';
import { CommitTreeAdapter } from '../../git-source-history/CommitTreeAdapter';
import { GitAdapter } from '../../git-source-history/GitAdapter';

/**
 * A clean export of one exact commit, outside every repository. Checks run here, so nothing in
 * the working tree can leak into a verification and nothing a check writes can reach the source.
 */
export class SnapshotAdapter {
	private readonly links = new Map<string, string>();
	private readonly exported: TreeEntry[] = [];

	private constructor(
		readonly directory: string,
		private readonly tracked: TreeEntry[],
		private readonly outputs: string[]
	) {}

	/** `outputs` are the declared patterns under which setup and checks may create files. */
	static async create(root: string, commit: string, outputs: string[]): Promise<SnapshotAdapter> {
		const directory = await mkdtemp(join(tmpdir(), 'harness-snapshot-'));
		const archive = await new GitAdapter(root).bytes(['archive', '--format=tar', commit]);
		await extract(archive, directory);
		const entries = await (await CommitTreeAdapter.open(root, commit)).list();
		const snapshot = new SnapshotAdapter(directory, entries, outputs);
		const hashes = await snapshot.hashes(entries);
		snapshot.exported.push(...entries.filter((entry, index) => hashes[index] === entry.hash));
		return snapshot;
	}

	/** Shares a path from the checkout, such as installed dependencies, when it exists there. */
	async link(root: string, path: string): Promise<boolean> {
		const source = join(root, path);
		const target = join(this.directory, path);
		if (!existsSync(source) || existsSync(target) || !existsSync(dirname(target))) return false;
		await symlink(source, target);
		this.links.set(path, source);
		return true;
	}

	/** Declared outputs that cover a tracked file, each with one such file. */
	misdeclared(): Array<{ output: string; file: string }> {
		return this.outputs.flatMap((output) => {
			const covered = this.tracked.find((entry) => pathMatches(entry.path, output));
			return covered ? [{ output, file: covered.path }] : [];
		});
	}

	/**
	 * Compares the snapshot with the commit. Nothing tracked may change or disappear, and
	 * nothing may appear outside the declared outputs, wherever it is and whatever it is.
	 */
	async drift(): Promise<SnapshotDrift> {
		const hashes = await this.hashes(this.exported);
		const changed = this.exported.filter((entry, index) => hashes[index] !== entry.hash);
		const added = await snapshotAdditions(this.directory, {
			tracked: new Set(this.tracked.map((entry) => entry.path)),
			outputs: this.outputs,
			links: new Set(this.links.keys())
		});
		return { mutated: [...changed.map((entry) => entry.path), ...(await this.relinked())], added };
	}

	/** Shared links that no longer point where they were made to point. */
	private async relinked(): Promise<string[]> {
		const current = await Promise.all(
			[...this.links.keys()].map((path) =>
				readlink(join(this.directory, path)).catch(() => undefined)
			)
		);
		return [...this.links].flatMap(([path, source], index) =>
			current[index] === source ? [] : [path]
		);
	}

	/** Size and hash of a file a setup command or check built inside the snapshot. */
	async artifact(path: string): Promise<{ bytes: number; sha256: string } | undefined> {
		const target = resolve(this.directory, path);
		if (!target.startsWith(`${this.directory}/`)) return undefined;
		try {
			const bytes = await readFile(target);
			return { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
		} catch {
			return undefined;
		}
	}

	/** Copies one declared generated file into the run directory, or undefined when it is not eligible. */
	async retainArtifact(
		sourcePath: string,
		runDirectory: string
	): Promise<RetainedArtifact | undefined> {
		if (!isPortableRelativePath(sourcePath) || !declaredOutput(sourcePath, this.outputs))
			return undefined;
		const bytes = await readSnapshotFile(this.directory, sourcePath);
		if (!bytes) return undefined;
		await writeRetained(resolve(runDirectory, RETAINED_PATH), bytes);
		const sha256 = createHash('sha256').update(bytes).digest('hex');
		return { sourcePath, path: RETAINED_PATH, bytes: bytes.length, sha256 };
	}

	remove(): Promise<void> {
		return rm(this.directory, { recursive: true, force: true });
	}

	private async hash(path: string): Promise<string | undefined> {
		try {
			const bytes = await readFile(join(this.directory, path));
			return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
		} catch {
			return undefined;
		}
	}

	/** A repository export can contain thousands of files; retain one read at a time. */
	private async hashes(entries: TreeEntry[]): Promise<Array<string | undefined>> {
		const hashes: Array<string | undefined> = [];
		for (const entry of entries) hashes.push(await this.hash(entry.path));
		return hashes;
	}
}

function extract(archive: Buffer, directory: string): Promise<void> {
	const tar = spawn('tar', ['-x', '-C', directory], { stdio: ['pipe', 'ignore', 'pipe'] });
	const errors: Buffer[] = [];
	tar.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
	tar.stdin.end(archive);
	return new Promise((resolve, reject) => {
		tar.once('error', reject);
		tar.once('close', (code) =>
			code === 0
				? resolve()
				: reject(new TarExtractError(`tar failed: ${Buffer.concat(errors).toString()}`))
		);
	});
}

const RETAINED_PATH = 'artifacts/export';
const MAX_RETAINED_BYTES = 64 * 1024 * 1024;
const RETAIN_OPEN_FLAGS = constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK;
const RESERVED_CHARACTERS = /[\\<>:"|?*]/;

/** No empty, `.` or `..` segments, no backslash, control or Windows-reserved characters, not absolute. */
function isPortableRelativePath(path: string): boolean {
	if (path === '' || path.startsWith('/') || RESERVED_CHARACTERS.test(path)) return false;
	if ([...path].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return false;
	return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

/** The lstat of the file when each ancestor below the snapshot root is a real directory. */
async function eligibleFile(directory: string, path: string): Promise<Stats | undefined> {
	const segments = path.split('/');
	const name = segments.pop() ?? '';
	let current = directory;
	for (const segment of segments) {
		current = join(current, segment);
		const info = await lstat(current).catch(() => undefined);
		if (!info?.isDirectory()) return undefined;
	}
	const info = await lstat(join(current, name)).catch(() => undefined);
	return info?.isFile() ? info : undefined;
}

/** Exact bytes of an eligible, nonempty file at most 64 MiB, or undefined if it changed while read. */
async function readSnapshotFile(directory: string, path: string): Promise<Buffer | undefined> {
	const linked = await eligibleFile(directory, path);
	if (!linked || linked.size < 1 || linked.size > MAX_RETAINED_BYTES) return undefined;
	const handle = await open(join(directory, path), RETAIN_OPEN_FLAGS).catch(() => undefined);
	if (!handle) return undefined;
	try {
		const opened = await handle.stat();
		const swapped = opened.dev !== linked.dev || opened.ino !== linked.ino;
		if (swapped || !opened.isFile() || opened.size !== linked.size) return undefined;
		return await readExact(handle, linked.size);
	} finally {
		await handle.close();
	}
}

/** Reads exactly `size` bytes, then one probe byte: any byte beyond the stat size means the file grew. */
async function readExact(handle: FileHandle, size: number): Promise<Buffer | undefined> {
	const bytes = Buffer.alloc(size);
	let total = 0;
	while (total < size) {
		const { bytesRead } = await handle.read(bytes, total, size - total, null);
		if (bytesRead === 0) return undefined;
		total += bytesRead;
	}
	const probe = await handle.read(Buffer.alloc(1), 0, 1, null);
	return probe.bytesRead === 0 ? bytes : undefined;
}

/** Writes a new 0600 file; a failed write removes what it created and leaves existing files alone. */
async function writeRetained(path: string, bytes: Buffer): Promise<void> {
	await mkdir(dirname(path), { recursive: true, mode: 0o700 });
	const handle = await open(path, 'wx', 0o600);
	try {
		await handle.writeFile(bytes);
		await handle.close();
	} catch (error) {
		await handle.close().catch(() => undefined);
		await rm(path, { force: true }).catch(() => undefined);
		throw error;
	}
}

export type { RetainedArtifact, SnapshotDrift } from './SnapshotAdapter.types';
