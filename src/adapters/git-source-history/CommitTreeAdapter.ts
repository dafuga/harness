// @harness-uid u_wri2ddoz2t
import { setImmediate } from 'node:timers';
import type { SourceTree, TreeEntry } from '../../core/development-tooling/sourceTypes';
import { fail } from '../../core/development-tooling/errors';
import { GitAdapter } from './GitAdapter';
import { CommitFileNotFoundError, type PendingRead } from './CommitTreeAdapter.types';

/** Reads the files of one exact commit straight from the object database. */
export class CommitTreeAdapter implements SourceTree {
	private listed: Promise<TreeEntry[]> | undefined;
	private readonly waiting = new Map<string, PendingRead[]>();
	private flushing = false;

	private constructor(
		private readonly git: GitAdapter,
		readonly revision: string,
		private readonly signal?: AbortSignal
	) {}

	/** Resolves any revision expression to a commit, failing when it does not name one. */
	static async open(
		root: string,
		reference: string,
		signal?: AbortSignal
	): Promise<CommitTreeAdapter> {
		const git = new GitAdapter(root);
		const commit = await git.attempt(
			['rev-parse', '--verify', '--quiet', '--end-of-options', `${reference}^{commit}`],
			{ signal }
		);
		if (!commit) return fail(`"${reference}" does not name a commit in this repository.`);
		return new CommitTreeAdapter(git, commit, signal);
	}

	list(): Promise<TreeEntry[]> {
		this.listed ??= this.git
			.run(['ls-tree', '-r', '-z', this.revision], { signal: this.signal })
			.then((output) =>
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
		if (!entry) throw new CommitFileNotFoundError(`${path} does not exist at ${this.revision}`);
		return new Promise((resolve, reject) => {
			const reads = this.waiting.get(entry.hash) ?? [];
			reads.push({ resolve, reject });
			this.waiting.set(entry.hash, reads);
			if (this.flushing) return;
			this.flushing = true;
			setImmediate(() => void this.flush());
		});
	}

	private async flush(): Promise<void> {
		const requested = new Map(this.waiting);
		this.waiting.clear();
		this.flushing = false;
		const input = [...requested.keys()].join('\n') + '\n';
		try {
			const output = await this.git.bytes(['cat-file', '--batch'], { input, signal: this.signal });
			resolveReads(requested, output);
		} catch (error) {
			for (const reads of requested.values()) reads.forEach(({ reject }) => reject(error));
		}
	}
}

function resolveReads(requested: Map<string, PendingRead[]>, output: Buffer): void {
	let offset = 0;
	for (const [hash, reads] of requested) {
		const end = output.indexOf(10, offset);
		const [object, type, length] = output.subarray(offset, end).toString('utf8').split(' ');
		const size = Number(length);
		if (
			end < 0 ||
			object !== hash ||
			type !== 'blob' ||
			!Number.isSafeInteger(size) ||
			size < 0 ||
			output[end + 1 + size] !== 10
		)
			throw new Error('Git did not return the requested committed blob.');
		const text = output.subarray(end + 1, end + 1 + size).toString('utf8');
		offset = end + size + 2;
		for (const { resolve } of reads) resolve(text);
	}
}
