// @harness-uid u_pkblm2rnm6
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
		const size = Number(await this.git.attempt(['cat-file', '-s', `${commit}:${path}`]));
		if (!Number.isSafeInteger(size)) return undefined;
		const result = await this.git.exec(['cat-file', 'blob', `${commit}:${path}`], {
			maxBuffer: batchBufferBytes([size])
		});
		return result.code === 0 ? result.stdout : undefined;
	}

	/** Exact raw blobs in one batch; missing paths stay absent and duplicate objects are read once. */
	async readMany(commit: string, paths: string[]): Promise<Map<string, Buffer>> {
		if (paths.length === 0) return new Map();
		const listed = await this.list(commit, paths);
		const requested = paths.flatMap((path) => {
			const hash = listed.get(path);
			return hash ? [[path, hash] as const] : [];
		});
		const hashes = [...new Set(requested.map(([, hash]) => hash))];
		if (hashes.length === 0) return new Map();
		// Attached records reach hundreds of MB, beyond the adapter's default output cap: size the
		// batch from the object sizes the tree listing already reports (one `cat-file` call stays one).
		const sizes = this.blobSizes;
		const blobs = new Map<string, Buffer>();
		for (const group of batchGroups(hashes, sizes, batchCeiling)) {
			const bytes = await this.git.bytes(['cat-file', '--batch'], {
				input: group.join('\n') + '\n',
				maxBuffer: batchBufferBytes(group.map((hash) => sizes.get(hash) ?? 0))
			});
			for (const [hash, blob] of batchBlobs(bytes, group)) blobs.set(hash, blob);
		}
		return new Map(requested.map(([path, hash]) => [path, Buffer.from(blobs.get(hash)!)]));
	}

	/** Blob sizes seen by `list`, so a batch read can size its output buffer. */
	private readonly blobSizes = new Map<string, number>();

	/** Every file path at a commit with its blob id (sizes are kept for batch reads). */
	async list(commit: string, paths?: string[]): Promise<Map<string, string>> {
		if (paths?.length === 0) return new Map();
		const output = await this.git.run([
			'--literal-pathspecs',
			'ls-tree',
			'-r',
			'-l',
			'-z',
			commit,
			...(paths ? ['--', ...paths] : [])
		]);
		const entries = output
			.split('\0')
			.map((line) => /^\d+ blob ([0-9a-f]+) +([0-9]+)\t(.+)$/s.exec(line))
			.flatMap((match): Array<[string, string]> => {
				if (!match) return [];
				this.blobSizes.set(match[1], Number(match[2]));
				return [[match[3], match[1]]];
			});
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
/** The bounded adapter accepts output buffers up to 2^31 - 1 bytes. */
const batchCeiling = 2_000_000_000;

/** Room for git's batch output of these blobs: each body, its header line and newline. */
export function batchBufferBytes(sizes: number[]): number {
	return Math.max(
		1,
		sizes.reduce((total, size) => total + size + 128, 0)
	);
}

/** Hashes in request order, grouped so each group's batch output stays under the ceiling. */
export function batchGroups(
	hashes: string[],
	sizes: Map<string, number>,
	ceiling: number
): string[][] {
	const groups: string[][] = [];
	let current: string[] = [];
	for (const hash of hashes) {
		const next = [...current, hash];
		if (current.length && batchBufferBytes(next.map((item) => sizes.get(item) ?? 0)) > ceiling) {
			groups.push(current);
			current = [hash];
		} else current = next;
	}
	if (current.length) groups.push(current);
	return groups;
}

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
