import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import type { LfsObject } from '../utils/lfsPointer';
import { GitAdapter } from './GitAdapter';

/**
 * The repository's Git LFS object store, addressed by the sha256 of the original bytes, and its
 * transfer with a remote. Objects are written and read directly, so no LFS filter has to be
 * installed in anyone's Git configuration.
 */
export class LfsAdapter {
	private readonly git: GitAdapter;
	private objects: Promise<string> | undefined;

	constructor(private readonly root: string) {
		this.git = new GitAdapter(root);
	}

	/** Where the object with this id is, or would be, stored. */
	async path(oid: string): Promise<string> {
		this.objects ??= this.git.run(['rev-parse', '--git-common-dir']).then((common) => {
			const directory = isAbsolute(common) ? common : join(this.root, common);
			return join(directory, 'lfs', 'objects');
		});
		return join(await this.objects, oid.slice(0, 2), oid.slice(2, 4), oid);
	}

	/** The original bytes, or undefined when the object has not been fetched. */
	async read(oid: string): Promise<Buffer | undefined> {
		return readFile(await this.path(oid)).catch(() => undefined);
	}

	/**
	 * Stores bytes under their hash. Several writers may store the same object at once: each
	 * writes its own temporary file and renames it into place, and since the name is the hash of
	 * the content, whichever rename lands leaves the same bytes there.
	 */
	async store(bytes: Buffer): Promise<LfsObject> {
		const sha256 = createHash('sha256').update(bytes).digest('hex');
		const target = await this.path(sha256);
		if ((await this.read(sha256)) === undefined) {
			const partial = `${target}.${process.pid}.${randomUUID()}.partial`;
			await mkdir(dirname(target), { recursive: true });
			await writeFile(partial, bytes);
			await rename(partial, target).catch(async (error: unknown) => {
				await rm(partial, { force: true });
				if ((await this.read(sha256)) === undefined) throw error;
			});
		}
		return { sha256, bytes: bytes.length };
	}

	/**
	 * Uploads every object reachable from the ref. `--all` asks the remote about each object
	 * instead of trusting which commits it already has, so an interrupted upload is completed.
	 */
	async push(remote: string, ref: string): Promise<void> {
		await this.git.run(['lfs', 'push', '--all', remote, ref]);
	}

	/** Downloads the ref's objects that are not stored locally; returns what went wrong, if anything. */
	async fetch(remote: string, ref: string): Promise<string | undefined> {
		const result = await this.git.exec(['lfs', 'fetch', remote, ref]);
		if (result.code === 0) return undefined;
		const lines = result.stderr.split('\n').filter((line) => /error|missing|fail/i.test(line));
		return lines[0]?.trim() ?? 'git lfs fetch failed';
	}
}
