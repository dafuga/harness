import { spawnSync } from 'node:child_process';
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
		const missing = await CommitTreeAdapter.open(root, 'absent').catch((error: Error) => error);
		expect(missing.constructor.name).toBe('ExpectedCliError');
		expect(missing).toHaveProperty(
			'message',
			'"absent" does not name a commit in this repository.'
		);
		const failure = new Error('synthetic revision resolution failure');
		vi.spyOn(GitAdapter.prototype, 'attempt').mockRejectedValueOnce(failure);
		await expect(CommitTreeAdapter.open(root, 'HEAD')).rejects.toBe(failure);
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
		const failure = new Error('synthetic object format command failure');
		vi.spyOn(GitAdapter.prototype, 'run').mockRejectedValueOnce(failure);
		await expect(CommitTreeAdapter.open(root, 'HEAD')).rejects.toBe(failure);
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
		const failing = await CommitTreeAdapter.open(root, 'HEAD');
		const failure = new Error('synthetic ls-tree failure');
		const run = vi.spyOn(GitAdapter.prototype, 'run').mockRejectedValue(failure);
		await expect(failing.list()).rejects.toBe(failure);
		await expect(failing.list()).rejects.toBe(failure);
		await expect(failing.read('sample.txt')).rejects.toBe(failure);
		expect(run).toHaveBeenCalledTimes(1);
	});
});
test('CommitTreeAdapter.read empty rejects missing paths', async () => {
	await fixture(false, async (root) => {
		const tree = await CommitTreeAdapter.open(root, 'HEAD');
		await expect(tree.read('absent')).rejects.toEqual(
			new Error(`absent does not exist at ${tree.revision}`)
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
				for (const path of ['missing', 'sample', './sample.txt', 'Sample.txt'])
					await expect(first.read(path)).rejects.toEqual(
						new Error(`${path} does not exist at ${first.revision}`)
					);
			},
			format
		);
	await fixture(false, async (root) => verifyBatchFailure(root));
});

// A child owns the rejection listener, so a product bug cannot become a Vitest runner error.
function verifyBatchFailure(root: string) {
	const adapter = new URL('../../../src/adapters/git-source-history/', import.meta.url).pathname;
	const result = spawnSync(
		'bun',
		[
			'--eval',
			String.raw`
		import { CommitTreeAdapter } from ${JSON.stringify(adapter + 'CommitTreeAdapter.ts')};
		import { GitAdapter } from ${JSON.stringify(adapter + 'GitAdapter.ts')};
		const failure = new Error('synthetic batch bytes failure');
		const unhandled = [];
		process.on('unhandledRejection', (error) => unhandled.push(error === failure));
		const hashes = ['a'.repeat(40), 'b'.repeat(40)];
		GitAdapter.prototype.attempt = async () => 'c'.repeat(40);
		GitAdapter.prototype.run = async (args) => args.includes('--show-object-format')
			? 'sha1' : hashes.map((hash, i) => '100644 blob ' + hash + '\tfile' + i + '\0').join('');
		let batches = 0;
		GitAdapter.prototype.bytes = async () => {
			if (++batches === 1) throw failure;
			return Buffer.from(hashes.map(hash => hash + ' blob 2\nok\n').join(''));
		};
		const tree = await CommitTreeAdapter.open(${JSON.stringify(root)}, 'HEAD');
		async function bounded(reads) {
			let timer;
			const settled = Promise.all(reads.map(read => read.then(
				value => ({ value }), error => ({ originalError: error === failure })
			)));
			try {
				return await Promise.race([settled,
					new Promise(resolve => { timer = setTimeout(() => resolve('pending'), 150); })]);
			} finally { clearTimeout(timer); }
		}
		const first = await bounded([tree.read('file0'), tree.read('file0'), tree.read('file1')]);
		const retry = await bounded([tree.read('file0'), tree.read('file1')]);
		await new Promise(resolve => setTimeout(resolve, 0));
		console.log(JSON.stringify({ first, retry, batches, unhandled }));
	`
		],
		{ encoding: 'utf8', timeout: 5000 }
	);
	expect(result.error, 'batch probe must start and terminate normally').toBeUndefined();
	expect(result.status, result.stderr).toBe(0);
	const observed = JSON.parse(result.stdout);
	expect(observed, 'all pending reads must reject with the original error, then retry').toEqual({
		first: [{ originalError: true }, { originalError: true }, { originalError: true }],
		retry: [{ value: 'ok' }, { value: 'ok' }],
		batches: 2,
		unhandled: []
	});
}
