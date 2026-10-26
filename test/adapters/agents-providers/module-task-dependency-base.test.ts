import { expect, test, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ModuleTaskDependencyBaseAdapter } from '../../../src/adapters/agents-providers/ModuleTaskDependencyBaseAdapter';

test('ModuleTaskDependencyBaseAdapter.connect from default initialization returns the file name', () => {
	// => 'module-task-dependency-base'
	expect(new ModuleTaskDependencyBaseAdapter().connect()).toBe('module-task-dependency-base');
});

test('ModuleTaskDependencyBaseAdapter.connect from custom initialization returns the configured name', () => {
	// => 'custom'
	expect(new ModuleTaskDependencyBaseAdapter({ name: 'custom' }).connect()).toBe('custom');
});

test('ModuleTaskDependencyBaseAdapter.connect with invalid config throws TypeError', () => {
	const adapter = new ModuleTaskDependencyBaseAdapter(null as never);
	// throws TypeError
	expect(() => adapter.connect()).toThrow(TypeError);
});

const execute = promisify(execFile);
async function dependencyFixture() {
	const root = await mkdtemp(join(tmpdir(), 'dependency-base-test-'));
	const git = async (...args: string[]) =>
		(
			await execute('git', [
				'-C',
				root,
				'-c',
				'user.name=Synthetic Test',
				'-c',
				'user.email=test@example.invalid',
				...args
			])
		).stdout.trim();
	await git('init', '-b', 'main');
	await writeFile(join(root, 'a.txt'), 'base a\n');
	await writeFile(join(root, 'b.txt'), 'base b\n');
	await git('add', '.');
	await git('commit', '-m', 'synthetic base');
	const sourceCommit = await git('rev-parse', 'HEAD');
	const checkpoint = async (path: string, text: string) => {
		await git('checkout', '--detach', sourceCommit);
		await writeFile(join(root, path), text);
		await git('add', path);
		await git('commit', '-m', `synthetic ${text.trim()}`);
		return git('rev-parse', 'HEAD');
	};
	const first = await checkpoint('a.txt', 'accepted a\n');
	const second = await checkpoint('b.txt', 'accepted b\n');
	const conflict = await checkpoint('a.txt', 'conflicting a\n');
	const unrelated = await git(
		'commit-tree',
		await git('rev-parse', `${sourceCommit}^{tree}`),
		'-m',
		'synthetic unrelated'
	);
	await git('checkout', 'main');
	await writeFile(join(root, 'a.txt'), 'user staged content\n');
	await git('add', 'a.txt');
	await writeFile(join(root, 'b.txt'), 'user unstaged content\n');
	await writeFile(join(root, 'untracked.txt'), 'user untracked content\n');
	const validateMetadata = vi.fn(async (_root: string, _commit: string) => {});
	return {
		root,
		git,
		sourceCommit,
		first,
		second,
		conflict,
		unrelated,
		validateMetadata,
		adapter: new ModuleTaskDependencyBaseAdapter(root, { validateMetadata }),
		dispose: () => rm(root, { recursive: true, force: true })
	};
}

async function userState(f: Awaited<ReturnType<typeof dependencyFixture>>) {
	return {
		head: await f.git('rev-parse', 'HEAD'),
		branch: await f.git('symbolic-ref', 'HEAD'),
		branches: await f.git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'),
		status: await f.git('status', '--porcelain=v1'),
		index: await readFile(join(f.root, '.git/index')),
		files: await Promise.all(
			['a.txt', 'b.txt', 'untracked.txt'].map((path) => readFile(join(f.root, path), 'utf8'))
		),
		indexFiles: (await readdir(join(f.root, '.git')))
			.filter((name) => name.includes('index'))
			.sort()
	};
}

async function assertComposedCheckpoints(f: Awaited<ReturnType<typeof dependencyFixture>>) {
	const before = await userState(f);
	const request = { sourceCommit: f.sourceCommit, checkpoints: [f.first, f.second] };
	const original = structuredClone(request);
	expect(await f.adapter.resolve({ sourceCommit: f.sourceCommit, checkpoints: [] })).toBe(
		f.sourceCommit
	);
	expect(await f.adapter.resolve({ sourceCommit: f.sourceCommit, checkpoints: [f.first] })).toBe(
		f.first
	);
	const merged = await f.adapter.resolve(request);
	expect(merged).toMatch(/^[0-9a-f]{40,64}$/);
	expect(await f.git('cat-file', '-t', merged)).toBe('commit');
	expect(await f.git('show', `${merged}:a.txt`)).toBe('accepted a');
	expect(await f.git('show', `${merged}:b.txt`)).toBe('accepted b');
	for (const checkpoint of request.checkpoints)
		await f.git('merge-base', '--is-ancestor', checkpoint, merged);
	expect(await f.adapter.resolve(request)).toBe(merged);
	expect(request).toEqual(original);
	for (const commit of [f.sourceCommit, f.first, merged])
		expect(f.validateMetadata).toHaveBeenCalledWith(f.root, commit);
	const refs = await f.git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/harness');
	expect(
		refs.split('\n').some((line) => line.startsWith('refs/harness/') && line.endsWith(` ${merged}`))
	).toBe(true);
	expect(await userState(f)).toEqual(before);
}

async function assertRejectedCheckpoints(f: Awaited<ReturnType<typeof dependencyFixture>>) {
	for (const checkpoints of [['f'.repeat(40)], [f.unrelated], [f.first, f.conflict]]) {
		const before = await userState(f);
		const refs = await f.git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/harness');
		await expect(
			f.adapter.resolve({ sourceCommit: f.sourceCommit, checkpoints })
		).rejects.toThrow();
		expect(await userState(f)).toEqual(before);
		expect(await f.git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/harness')).toBe(
			refs
		);
	}
}

async function assertMetadataGate() {
	const f = await dependencyFixture();
	try {
		const before = await userState(f);
		f.validateMetadata.mockRejectedValue(new Error('metadata rejected'));
		for (const checkpoints of [[], [f.first], [f.first, f.second]]) {
			await expect(
				f.adapter.resolve({ sourceCommit: f.sourceCommit, checkpoints })
			).rejects.toThrow('metadata rejected');
			expect(await f.git('for-each-ref', '--format=%(refname)', 'refs/harness')).toBe('');
			expect(await userState(f)).toEqual(before);
		}
	} finally {
		await f.dispose();
	}
}

test('ModuleTaskDependencyBaseAdapter.resolve composes accepted checkpoints without changing user state', async () => {
	const f = await dependencyFixture();
	try {
		await assertComposedCheckpoints(f);
		await assertRejectedCheckpoints(f);
	} finally {
		await f.dispose();
	}
	await assertMetadataGate();
});
