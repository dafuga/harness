import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitIdentity } from '../utils/commitIdentity';
import { GitAdapter } from './GitAdapter';

export interface TreeFile {
	/** Path inside the tree. */
	path: string;
	/** Content, a file on disk whose bytes are stored unchanged, or a blob Git already has. */
	content: { bytes: Buffer | string } | { file: string } | { blob: string };
}

export interface TreeCommit {
	/** First parent supplies the starting tree; further parents record a merge. */
	parents: string[];
	files: TreeFile[];
	message: string;
}

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
