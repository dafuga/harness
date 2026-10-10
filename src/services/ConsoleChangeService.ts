import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
	ConsoleChange,
	ConsoleFileEntry,
	ConsoleManifest,
	FileIdentity
} from '../utils/consoleManifest';

/** Project-local copies of everything an install replaced, named by content hash. */
export const replacedDirectory = '.harness/console/replaced';

export type FileState =
	/** Nothing is there, or it already holds exactly the wanted content. */
	| { kind: 'free' }
	/** Harness wrote it and nobody changed it since, so rewriting loses nothing. */
	| { kind: 'unchanged' }
	/** The host keeps its own version on purpose. */
	| { kind: 'kept'; reason: string }
	/** Writing would lose content Harness did not put there. */
	| { kind: 'conflict'; reason: string };

function identity(bytes: Buffer): FileIdentity {
	return { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}

/**
 * Keeps an install from losing work. It says what writing a file would overwrite, and when a
 * replacement is asked for it first saves the current bytes inside the project and records the
 * change with the identity of both sides.
 */
export class ConsoleChangeService {
	constructor(
		private readonly host: string,
		private readonly manifest: ConsoleManifest
	) {}

	/** What stands in the way of writing `contents` to `path`; null contents means removing it. */
	async state(path: string, contents: string | null): Promise<FileState> {
		const current = await this.read(path);
		const wanted = contents === null ? undefined : identity(Buffer.from(contents)).sha256;
		if (!current || identity(current).sha256 === wanted) return { kind: 'free' };
		const entry = this.entry(path);
		if (!entry) return { kind: 'conflict', reason: 'host-owned' };
		if (entry.owner === 'host') return { kind: 'kept', reason: 'kept by the host' };
		return entry.sha256 === identity(current).sha256
			? { kind: 'unchanged' }
			: { kind: 'conflict', reason: 'edited since it was installed' };
	}

	/** Saves what `path` holds, then writes or removes it, and returns the record of the change. */
	async replace(
		path: string,
		contents: string | null,
		change: Pick<ConsoleChange, 'action' | 'reason'>
	): Promise<ConsoleChange> {
		const current = (await this.read(path)) ?? Buffer.alloc(0);
		const before = identity(current);
		const saved = `${replacedDirectory}/${before.sha256}`;
		await mkdir(join(this.host, replacedDirectory), { recursive: true });
		await writeFile(join(this.host, saved), current);
		if (contents === null) await rm(join(this.host, path), { force: true });
		else await this.write(path, contents);
		const after = contents === null ? null : identity(Buffer.from(contents));
		return { path, ...change, at: new Date().toISOString(), before: { ...before, saved }, after };
	}

	/** Puts back what the latest change to `path` replaced; the current content is saved in turn. */
	async restore(path: string): Promise<ConsoleChange | undefined> {
		const latest = [...this.manifest.changes].reverse().find((change) => change.path === path);
		const bytes = latest ? await this.read(latest.before.saved) : undefined;
		if (!latest || !bytes) return undefined;
		const reason = `restores what was ${latest.action} at ${latest.at}`;
		return this.replace(path, bytes.toString('utf8'), { action: 'restored', reason });
	}

	/** Removes a file Harness wrote and nobody changed; its content can be generated again. */
	async remove(path: string): Promise<void> {
		await rm(join(this.host, path), { force: true });
	}

	async write(path: string, contents: string): Promise<void> {
		await mkdir(dirname(join(this.host, path)), { recursive: true });
		await writeFile(join(this.host, path), contents);
	}

	/** The entry a file has after this run: Harness's when it wrote it, the host's when kept. */
	async entryFor(path: string, owner: ConsoleFileEntry['owner']): Promise<ConsoleFileEntry> {
		const bytes = (await this.read(path)) ?? Buffer.alloc(0);
		return { path, sha256: identity(bytes).sha256, owner };
	}

	private entry(path: string): ConsoleFileEntry | undefined {
		return this.manifest.files.find((file) => file.path === path);
	}

	private read(path: string): Promise<Buffer | undefined> {
		return readFile(join(this.host, path)).catch(() => undefined);
	}
}
