import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readlink, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { TreeEntry } from "../../core/sourceTypes";
import { pathMatches } from "../../core/unitsConfig";
import { snapshotAdditions } from "./snapshotAdditions";
import { CommitTreeAdapter } from "../CommitTreeAdapter";
import { GitAdapter } from "../GitAdapter";

export interface SnapshotDrift {
	/** Tracked files that were changed or deleted, and shared links that were replaced. */
	mutated: string[];
	/** Files the commit does not contain and no output declaration covers. */
	added: string[];
}

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
		const hashes = await Promise.all(entries.map((entry) => snapshot.hash(entry.path)));
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
		const hashes = await Promise.all(this.exported.map((entry) => this.hash(entry.path)));
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
