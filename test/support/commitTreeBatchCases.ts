import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setImmediate } from 'node:timers';
import { expect, vi } from 'vitest';
import { CommitTreeAdapter } from '../../src/adapters/git-source-history/CommitTreeAdapter';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';

/** The existing populated read case exercises real Git data and its bounded process boundary. */
export async function assertBoundedCommittedReads(
	root: string,
	git: GitAdapter,
	batches: () => string[]
): Promise<void> {
	const sizes = await writeBatchFixture(root, git);
	const tree = await CommitTreeAdapter.open(root, 'HEAD');
	const entries = new Map((await tree.list()).map((item) => [item.path, item.hash]));
	const before = batches().length;
	const observed = await overlappingReads(tree, [...sizes.keys()]);
	const hashes = new Map([...sizes].map(([path, size]) => [entries.get(path)!, size]));
	const requests = batches()
		.slice(before)
		.map((input) => input.trim().split('\n'));
	expect(observed.maxActive, 'overlapping reads must serialize Git payload batches').toBe(1);
	expect(requests.length).toBeGreaterThan(1);
	for (const group of requests) {
		const bytes = group.reduce((sum, hash) => sum + (hashes.get(hash) ?? Infinity), 0);
		expect(group.length, 'a Git payload batch must contain at most 64 blobs').toBeLessThanOrEqual(
			64
		);
		expect(
			bytes <= 32 * 1024 * 1024 || group.length === 1,
			'Git payload bytes must be bounded'
		).toBe(true);
	}
	expect(observed.values.map((value) => value.length)).toEqual([...sizes.values()]);
	expect(observed.values.at(-2)?.[0]).toBe('A');
	expect(observed.values.at(-1)?.[0]).toBe('B');
	await assertMetadataFailures(root, git);
}

async function assertMetadataFailures(root: string, git: GitAdapter): Promise<void> {
	for (const mode of ['malformed', 'failed'] as const) {
		const files = ['first', 'second'].map((name) => `metadata-${mode}-${name}.txt`);
		const values = files.map((file) => `${root}: ${file}`);
		for (let index = 0; index < files.length; index++)
			await writeFile(join(root, files[index]), values[index]);
		await git.run(['add', '.']);
		await git.run(['commit', '-m', `feat: add ${mode} metadata fixture`]);
		const tree = await CommitTreeAdapter.open(root, 'HEAD');
		const original = GitAdapter.prototype.exec;
		let injected = false;
		const observer = vi.spyOn(GitAdapter.prototype, 'exec').mockImplementation(async function (
			this: GitAdapter,
			args,
			options
		) {
			if (!injected && args[0] === 'cat-file' && args[1]?.startsWith('--batch-check')) {
				injected = true;
				return mode === 'malformed'
					? { code: 0, stdout: Buffer.from('invalid metadata\n'), stderr: '' }
					: { code: 1, stdout: Buffer.alloc(0), stderr: 'synthetic metadata failure' };
			}
			return original.call(this, args, options);
		});
		try {
			const failed = await Promise.allSettled(files.map((file) => tree.read(file)));
			expect(
				failed.map((item) => item.status),
				`${mode} metadata must reject the batch`
			).toEqual(['rejected', 'rejected']);
		} finally {
			observer.mockRestore();
		}
		expect(await Promise.all(files.map((file) => tree.read(file)))).toEqual(values);
	}
}

async function writeBatchFixture(root: string, git: GitAdapter): Promise<Map<string, number>> {
	const sizes = new Map<string, number>();
	for (let index = 0; index < 130; index++) {
		const path = `batch-${String(index).padStart(3, '0')}.txt`;
		const value = `fixture ${index} ${root}`;
		await writeFile(join(root, path), value);
		sizes.set(path, Buffer.byteLength(value));
	}
	for (const [path, byte] of [
		['large-a.txt', 65],
		['large-b.txt', 66]
	] as const) {
		const size = 17 * 1024 * 1024;
		await writeFile(join(root, path), Buffer.alloc(size, byte));
		sizes.set(path, size);
	}
	await git.run(['add', '.']);
	await git.run(['commit', '-m', 'feat: add batch fixture']);
	return sizes;
}

async function overlappingReads(tree: CommitTreeAdapter, paths: string[]) {
	let active = 0,
		maxActive = 0,
		release = () => {},
		announce = () => {};
	const blocked = new Promise<void>((resolve) => (release = resolve));
	const started = new Promise<void>((resolve) => (announce = resolve));
	const original = GitAdapter.prototype.exec;
	const observer = vi.spyOn(GitAdapter.prototype, 'exec').mockImplementation(async function (
		this: GitAdapter,
		args,
		options
	) {
		if (args[0] !== 'cat-file' || args[1] !== '--batch') return original.call(this, args, options);
		active++;
		maxActive = Math.max(maxActive, active);
		if (active === 1) {
			announce();
			await blocked;
		}
		try {
			return await original.call(this, args, options);
		} finally {
			active--;
		}
	});
	try {
		const first = paths.slice(0, 64).map((path) => tree.read(path));
		await started;
		const later = paths.slice(64).map((path) => tree.read(path));
		await Promise.resolve();
		await new Promise<void>((resolve) => setImmediate(resolve));
		release();
		return { values: await Promise.all([...first, ...later]), maxActive };
	} finally {
		release();
		observer.mockRestore();
	}
}
