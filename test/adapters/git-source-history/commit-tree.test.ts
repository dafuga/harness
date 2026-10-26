import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, vi } from 'vitest';
import { CommitTreeAdapter } from '../../../src/adapters/git-source-history/CommitTreeAdapter';
import { GitAdapter } from '../../../src/adapters/git-source-history/GitAdapter';

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
			},
			format
		);
});
