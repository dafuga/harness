import type { TreeCommit, TreeFile } from './EvidenceTreeAdapter.types';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitIdentity } from '../../utils/git-source-history/commitIdentity';
import { GitAdapter } from '../git-source-history/GitAdapter';

const absent = '0'.repeat(40);

/**
 * Builds commits with Git plumbing: blobs, a private index and commit-tree. No working tree or
 * checkout is involved, and a ref moves only if nobody else moved it first.
 */
export class EvidenceTreeAdapter {
	readonly git: GitAdapter;

	constructor(root: string) {
		this.git = new GitAdapter(root);
	}

	tip(ref: string): Promise<string | undefined> {
		return this.git.attempt(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
	}

	/** True when `ancestor` is `descendant` or one of its ancestors and both are present. */
	async contains(descendant: string, ancestor: string): Promise<boolean> {
		const result = await this.git.exec(['merge-base', '--is-ancestor', ancestor, descendant]);
		return result.code === 0;
	}

	async exists(commit: string): Promise<boolean> {
		return (await this.git.exec(['cat-file', '-e', `${commit}^{commit}`])).code === 0;
	}

	/** Bytes of one file at a commit, or undefined when the commit or the path is absent. */
	async read(commit: string, path: string): Promise<Buffer | undefined> {
		const result = await this.git.exec(['cat-file', 'blob', `${commit}:${path}`]);
		return result.code === 0 ? result.stdout : undefined;
	}

	/** Exact raw blobs in one batch; missing paths stay absent and duplicate objects are read once. */
	async readMany(commit: string, paths: string[]): Promise<Map<string, Buffer>> {
		if (paths.length === 0) return new Map();
		const listed = await this.list(commit);
		const requested = paths.flatMap((path) => {
			const hash = listed.get(path);
			return hash ? [[path, hash] as const] : [];
		});
		const hashes = [...new Set(requested.map(([, hash]) => hash))];
		if (hashes.length === 0) return new Map();
		const bytes = await this.git.bytes(['cat-file', '--batch'], {
			input: hashes.join('\n') + '\n'
		});
		const blobs = batchBlobs(bytes, hashes);
		return new Map(requested.map(([path, hash]) => [path, Buffer.from(blobs.get(hash)!)]));
	}

	/** Every file path at a commit with its blob id. */
	async list(commit: string): Promise<Map<string, string>> {
		const output = await this.git.run(['ls-tree', '-r', '-z', commit]);
		const entries = output
			.split('\0')
			.map((line) => /^\d+ blob ([0-9a-f]+)\t(.+)$/s.exec(line))
			.flatMap((match): Array<[string, string]> => (match ? [[match[2], match[1]]] : []));
		return new Map(entries);
	}

	/** Creates a commit that adds files to its first parent's tree; no ref is moved. */
	async commit(input: TreeCommit): Promise<string> {
		const scratch = await mkdtemp(join(tmpdir(), 'harness-index-'));
		const env = { GIT_INDEX_FILE: join(scratch, 'index') };
		try {
			if (input.parents[0]) await this.git.run(['read-tree', input.parents[0]], { env });
			const blobs = await this.blobs(input.files);
			const info = input.files.map((file, index) => `100644 ${blobs[index]}\t${file.path}\n`);
			await this.git.run(['update-index', '--add', '--index-info'], { env, input: info.join('') });
			const tree = await this.git.run(['write-tree'], { env });
			const parents = input.parents.flatMap((parent) => ['-p', parent]);
			return await this.git.run(['commit-tree', tree, ...parents, '-m', input.message], {
				env: await commitIdentity(this.git)
			});
		} finally {
			await rm(scratch, { recursive: true, force: true });
		}
	}

	/** Moves a ref to `next` only if it still is `expected`; false means someone else moved it. */
	async advance(ref: string, next: string, expected: string | undefined): Promise<boolean> {
		const result = await this.git.exec(['update-ref', ref, next, expected ?? absent]);
		return result.code === 0;
	}

	/** Files on disk are hashed in one process; generated content one at a time. */
	private async blobs(files: TreeFile[]): Promise<string[]> {
		const onDisk = files.flatMap((file) => ('file' in file.content ? [file.content.file] : []));
		const hashed = onDisk.length
			? (await this.git.run(['hash-object', '-w', '--stdin-paths'], { input: onDisk.join('\n') }))
					.split('\n')
					.reverse()
			: [];
		const ids: string[] = [];
		for (const { content } of files) {
			if ('file' in content) ids.push(hashed.pop() ?? '');
			else if ('blob' in content) ids.push(content.blob);
			else ids.push(await this.git.run(['hash-object', '-w', '--stdin'], { input: content.bytes }));
		}
		return ids;
	}
}

/** Byte lengths delimit binary content; a malformed protocol response never becomes evidence. */
function batchBlobs(bytes: Buffer, hashes: string[]): Map<string, Buffer> {
	const blobs = new Map<string, Buffer>();
	let offset = 0;
	for (const hash of hashes) {
		const end = bytes.indexOf(10, offset);
		const header = /^([a-f0-9]+) blob ([0-9]+)$/.exec(
			bytes.subarray(offset, end).toString('ascii')
		);
		const size = Number(header?.[2]);
		if (end < 0 || header?.[1] !== hash || !Number.isSafeInteger(size))
			throw new Error('Invalid Git batch response');
		const start = end + 1,
			next = start + size;
		if (next >= bytes.length || bytes[next] !== 10) throw new Error('Invalid Git batch response');
		blobs.set(hash, bytes.subarray(start, next));
		offset = next + 1;
	}
	if (offset !== bytes.length) throw new Error('Invalid Git batch response');
	return blobs;
}

export type { TreeFile, TreeCommit } from './EvidenceTreeAdapter.types';
