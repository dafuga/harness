import type { SnapshotDrift } from './SnapshotAdapter.types';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, open, readFile, readlink, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { TreeEntry } from '../../../core/development-tooling/sourceTypes';
import { pathMatches } from '../../../core/development-tooling/unitsConfig';
import { snapshotAdditions } from './snapshotAdditions';
import { CommitTreeAdapter } from '../../git-source-history/CommitTreeAdapter';
import { GitAdapter } from '../../git-source-history/GitAdapter';

/**
 * A clean export of one exact commit, outside every repository. Checks run here, so nothing in
 * the working tree can leak into a verification and nothing a check writes can reach the source.
 */
export class SnapshotAdapter {
	private readonly links = new Map<string, string>();
	private readonly exported: TreeEntry[] = [];
	private inventoryHash = '';

	private constructor(
		readonly directory: string,
		private readonly tracked: TreeEntry[],
		private readonly outputs: string[]
	) {}

	/** `outputs` are the declared patterns under which setup and checks may create files. */
	static async create(root: string, commit: string, outputs: string[]): Promise<SnapshotAdapter> {
		const directory = await mkdtemp(join(tmpdir(), 'harness-snapshot-'));
		try {
			const archive = await new GitAdapter(root).bytes(['archive', '--format=tar', commit]);
			await extract(archive, directory);
			const tree = await CommitTreeAdapter.open(root, commit);
			const entries = await tree.list();
			const snapshot = new SnapshotAdapter(directory, entries, outputs);
			const hashes = await Promise.all(entries.map((entry) => snapshot.hash(entry.path)));
			snapshot.exported.push(...entries.filter((entry, index) => hashes[index] === entry.hash));
			const bytes = inventoryBytes(directory, tree.revision, snapshot.exported);
			await writeInventory(directory, bytes);
			snapshot.inventoryHash = digest(bytes);
			return snapshot;
		} catch (error) {
			await rm(directory, { recursive: true, force: true });
			throw error;
		}
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
		const hashes = await Promise.all(this.exported.map((entry) => this.hash(entry.path)));
		const changed = this.exported.filter((entry, index) => hashes[index] !== entry.hash);
		const added = await snapshotAdditions(this.directory, {
			tracked: new Set(this.tracked.map((entry) => entry.path)),
			outputs: this.outputs,
			links: new Set(this.links.keys())
		});
		const inventory = await readFile(inventoryPath(this.directory)).catch(() => undefined);
		const inventoryChanged = !inventory || digest(inventory) !== this.inventoryHash;
		return {
			mutated: [
				...changed.map((entry) => entry.path),
				...(await this.relinked()),
				...(inventoryChanged ? ['<snapshot-inventory>'] : [])
			],
			added
		};
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

	remove(): Promise<void> {
		return removeSnapshot(this.directory);
	}

	private async hash(path: string): Promise<string | undefined> {
		try {
			const bytes = await readFile(join(this.directory, path));
			return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
		} catch {
			return undefined;
		}
	}
}

const inventoryPath = (directory: string) => `${directory}.tracked.json`;
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
function inventoryBytes(directory: string, revision: string, entries: TreeEntry[]): Buffer {
	return Buffer.from(
		JSON.stringify({
			version: 1,
			root: directory,
			revision,
			files: entries.map((entry) => entry.path)
		})
	);
}
async function writeInventory(directory: string, bytes: Buffer): Promise<void> {
	const path = inventoryPath(directory);
	const file = await open(path, 'wx', 0o600);
	try {
		await file.writeFile(bytes);
		await file.close();
	} catch (error) {
		await file.close().catch(() => undefined);
		await rm(path, { force: true });
		throw error;
	}
}
async function removeSnapshot(directory: string): Promise<void> {
	await Promise.all([
		rm(directory, { recursive: true, force: true }),
		rm(inventoryPath(directory), { force: true })
	]);
}

function extract(archive: Buffer, directory: string): Promise<void> {
	const tar = spawn('tar', ['-x', '-C', directory], { stdio: ['pipe', 'ignore', 'pipe'] });
	const errors: Buffer[] = [];
	tar.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
	tar.stdin.end(archive);
	return new Promise((resolve, reject) => {
		tar.once('error', reject);
		tar.once('close', (code) =>
			code === 0 ? resolve() : reject(new Error(`tar failed: ${Buffer.concat(errors).toString()}`))
		);
	});
}

export type { SnapshotDrift } from './SnapshotAdapter.types';
