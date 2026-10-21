import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { collectAuditedFiles } from '../audit/collect';
import type { SourceTree, TreeEntry } from '../core/sourceTypes';
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
		const paths = (await this.git.isRepository()) ? await this.tracked() : await this.walked();
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
		const collected = await collectAuditedFiles(this.root, { includeNativeSources: true });
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
