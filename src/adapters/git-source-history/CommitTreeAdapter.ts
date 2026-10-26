import { setImmediate } from 'node:timers';
import type { SourceTree, TreeEntry } from '../../core/development-tooling/sourceTypes';
import { fail } from '../../core/development-tooling/errors';
import { GitAdapter } from './GitAdapter';
import { cachedBlobText, keepBlobText } from './commit-tree-adapter/blobTexts';

/** Reads the files of one exact commit straight from the object database. */
export class CommitTreeAdapter implements SourceTree {
	private listed: Promise<TreeEntry[]> | undefined;
	private readonly waiting = new Map<string, Array<(text: string) => void>>();
	private readonly texts = new Map<string, Promise<string>>();
	private flushing = false;

	private constructor(
		private readonly git: GitAdapter,
		readonly revision: string,
		private readonly format: string
	) {}

	/** Resolves any revision expression to a commit, failing when it does not name one. */
	static async open(root: string, reference: string): Promise<CommitTreeAdapter> {
		const git = new GitAdapter(root);
		const commit = await git.attempt(['rev-parse', '--verify', '--quiet', `${reference}^{commit}`]);
		if (!commit) return fail(`"${reference}" does not name a commit in this repository.`);
		const format = await git.run(['rev-parse', '--show-object-format']);
		if (!['sha1', 'sha256'].includes(format))
			return fail(`Unsupported Git object format: ${format}`);
		return new CommitTreeAdapter(git, commit, format);
	}

	list(): Promise<TreeEntry[]> {
		this.listed ??= this.git.run(['ls-tree', '-r', '-z', this.revision]).then((output) =>
			output
				.split('\0')
				.map((line) => /^\d+ blob ([0-9a-f]+)\t(.+)$/s.exec(line))
				.flatMap((match) => (match ? [{ path: match[2], hash: match[1] }] : []))
		);
		return this.listed;
	}

	/** Reads are gathered for one tick and served by a single `git cat-file --batch`. */
	async read(path: string): Promise<string> {
		const entry = (await this.list()).find((item) => item.path === path);
		if (!entry) throw new Error(`${path} does not exist at ${this.revision}`);
		const known = this.texts.get(entry.hash);
		if (known) return known;
		const cached = cachedBlobText(`${this.format}/${entry.hash}`);
		if (cached !== undefined) return cached;
		const pending = new Promise<string>((resolve) => {
			this.waiting.set(entry.hash, [...(this.waiting.get(entry.hash) ?? []), resolve]);
			if (this.flushing) return;
			this.flushing = true;
			setImmediate(() => void this.flush());
		});
		this.texts.set(entry.hash, pending);
		return pending;
	}

	private async flush(): Promise<void> {
		const requested = new Map(this.waiting);
		this.waiting.clear();
		this.flushing = false;
		const input = [...requested.keys()].join('\n') + '\n';
		const output = await this.git.bytes(['cat-file', '--batch'], { input });
		let offset = 0;
		for (const [hash, resolvers] of requested) {
			const end = output.indexOf(10, offset);
			const size = Number(output.subarray(offset, end).toString('utf8').split(' ')[2]);
			const text = output.subarray(end + 1, end + 1 + size).toString('utf8');
			offset = end + size + 2;
			keepBlobText(`${this.format}/${hash}`, text);
			for (const resolve of resolvers) resolve(text);
		}
	}
}
