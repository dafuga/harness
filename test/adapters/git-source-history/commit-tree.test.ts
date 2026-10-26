import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { CommitTreeAdapter } from '../../../src/adapters/git-source-history/CommitTreeAdapter';
import { GitAdapter } from '../../../src/adapters/git-source-history/GitAdapter';
import { measureWorkload } from '../../support/measureWorkload';

// Complete public-method matrix: a committed empty tree and a populated immutable tree.
async function fixture(
	populated: boolean,
	run: (root: string, git: GitAdapter, value: string) => Promise<void>,
	format = 'sha1'
) {
	const root = await mkdtemp(join(tmpdir(), 'harness-committed-tree-'));
	const git = new GitAdapter(root);
	const value = `Fixture owned by ${root}\n`;
	try {
		await git.run(['init', '-b', 'main', '--object-format=' + format]);
		await git.run(['config', 'user.name', 'Synthetic']);
		await git.run(['config', 'user.email', 'synthetic@example.invalid']);
		if (populated) {
			await writeFile(join(root, 'sample.txt'), value);
			await git.run(['add', '.']);
		}
		await git.run(['commit', '--allow-empty', '-m', 'chore: create fixture']);
		await run(root, git, value);
	} finally {
		vi.restoreAllMocks();
		await rm(root, { recursive: true, force: true });
	}
}

test('CommitTreeAdapter.open empty resolves the exact commit and refuses absent revisions', async () => {
	await fixture(false, async (root, git) => {
		const commit = await git.run(['rev-parse', 'HEAD']);
		expect((await CommitTreeAdapter.open(root, 'HEAD')).revision).toBe(commit);
		await expect(CommitTreeAdapter.open(root, 'absent')).rejects.toThrow('does not name a commit');
	});
});
test('CommitTreeAdapter.open populated establishes the object format before caching', async () => {
	await fixture(true, async (root, git) => {
		expect((await CommitTreeAdapter.open(root, 'main')).revision).toBe(
			await git.run(['rev-parse', 'HEAD'])
		);
		const run = GitAdapter.prototype.run;
		vi.spyOn(GitAdapter.prototype, 'run').mockImplementation(function (
			this: GitAdapter,
			args,
			options
		) {
			return args.includes('--show-object-format')
				? Promise.resolve('unknown')
				: run.call(this, args, options);
		});
		await expect(CommitTreeAdapter.open(root, 'HEAD')).rejects.toThrow(
			'Unsupported Git object format'
		);
	});
});
test('CommitTreeAdapter.list empty returns no source entries', async () => {
	await fixture(false, async (root) =>
		expect(await (await CommitTreeAdapter.open(root, 'HEAD')).list()).toEqual([])
	);
});
test('CommitTreeAdapter.list populated retains blob identities and paths', async () => {
	await fixture(true, async (root, git) => {
		const tree = await CommitTreeAdapter.open(root, 'HEAD');
		expect(await tree.list()).toEqual([
			{ path: 'sample.txt', hash: await git.run(['rev-parse', 'HEAD:sample.txt']) }
		]);
		expect(await tree.list()).toEqual(await tree.list());
	});
});
test('CommitTreeAdapter.read empty rejects missing paths', async () => {
	await fixture(false, async (root) => {
		await expect((await CommitTreeAdapter.open(root, 'HEAD')).read('absent')).rejects.toThrow(
			'does not exist'
		);
	});
});
test('CommitTreeAdapter.read populated reuses immutable blobs across revisions without stale paths', async () => {
	for (const format of ['sha1', 'sha256'])
		await fixture(
			true,
			async (root, git, value) => {
				const bytes = vi.spyOn(GitAdapter.prototype, 'bytes');
				const first = await CommitTreeAdapter.open(root, 'HEAD');
				expect(await Promise.all([first.read('sample.txt'), first.read('sample.txt')])).toEqual([
					value,
					value
				]);
				await git.run(['commit', '--allow-empty', '-m', 'chore: keep source']);
				expect(await (await CommitTreeAdapter.open(root, 'HEAD')).read('sample.txt')).toBe(value);
				expect(
					bytes.mock.calls.filter(([args]) => args[0] === 'cat-file'),
					'immutable blob should be read once across trees'
				).toHaveLength(1);
				await writeFile(join(root, 'sample.txt'), 'Changed fixture\n');
				await git.run(['add', '.']);
				await git.run(['commit', '-m', 'feat: change fixture']);
				expect(await (await CommitTreeAdapter.open(root, 'HEAD')).read('sample.txt')).toBe(
					'Changed fixture\n'
				);
				expect(await first.read('sample.txt')).toBe(value);
				await expect(first.read('missing')).rejects.toThrow('does not exist');
				if (format === 'sha1') {
					await measureWorkload('adapter.commit-tree', 'oversized-committed-blob', () =>
						oversizedBlob(
							root,
							git,
							() => bytes.mock.calls.filter(([args]) => args[0] === 'cat-file').length
						)
					);
					await missingBlob(
						root,
						git,
						() => void bytes.mockRejectedValueOnce(new Error('synthetic Git failure')),
						() => void bytes.mockResolvedValueOnce(Buffer.from('malformed response\n'))
					);
				}
			},
			format
		);
}, 60_000);

/** Oversized committed blobs must not escape the shared 64 MiB retained-text bound. */
async function oversizedBlob(root: string, git: GitAdapter, reads: () => number): Promise<void> {
	const size = 64 * 1024 * 1024 + 1;
	await writeFile(join(root, 'large.txt'), Buffer.alloc(size, 97));
	await git.run(['add', 'large.txt']);
	await git.run(['commit', '-m', 'feat: add oversized fixture']);
	const tree = await CommitTreeAdapter.open(root, 'HEAD');
	const before = reads();
	expect((await tree.read('large.txt')).length).toBe(size);
	expect((await tree.read('large.txt')).length).toBe(size);
	expect(reads() - before, 'oversized blobs must not remain in the per-tree cache').toBe(2);
}

/** Missing Git objects and broken batch reads remain errors, with valid peers and retries intact. */
async function missingBlob(
	root: string,
	git: GitAdapter,
	failNext: () => void,
	malformNext: () => void
): Promise<void> {
	const values = {
		present: `present ${root}`,
		missing: `missing ${root}`,
		retry: `retry ${root}`,
		malformed: `malformed ${root}`
	};
	for (const [name, value] of Object.entries(values))
		await writeFile(join(root, `${name}.txt`), value);
	await git.run(['add', '.']);
	await git.run(['commit', '-m', 'feat: add object fixtures']);
	const tree = await CommitTreeAdapter.open(root, 'HEAD');
	await tree.list();
	const hash = await git.run(['rev-parse', 'HEAD:missing.txt']);
	await rm(join(root, '.git', 'objects', hash.slice(0, 2), hash.slice(2)));
	const [present, missing] = await Promise.allSettled([
		tree.read('present.txt'),
		tree.read('missing.txt')
	]);
	expect(present).toEqual({ status: 'fulfilled', value: values.present });
	expect(missing.status, 'a missing committed blob must be reported').toBe('rejected');
	if (missing.status === 'rejected') expect(String(missing.reason)).toContain('missing');
	failNext();
	await expect(tree.read('retry.txt')).rejects.toThrow('synthetic Git failure');
	await expect(tree.read('retry.txt')).resolves.toBe(values.retry);
	malformNext();
	await expect(tree.read('malformed.txt')).rejects.toThrow('Invalid Git batch response');
	await expect(tree.read('malformed.txt')).resolves.toBe(values.malformed);
}
