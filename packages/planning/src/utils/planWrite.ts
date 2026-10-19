import { planCommit, stageFiles, requireLfsFilters } from './planCommit';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Git } from './planGit';
import { revision, safePath } from './planGit';
import { fail } from './planData';
import type { Committed } from '../models/PlanningView.types';
export type Files = Record<string, string | Uint8Array>;
const queues = new Map<string, Promise<unknown>>();
export async function planWrite<T>(git: Git, work: () => Promise<T>): Promise<T> {
	const before = queues.get(git.dir) ?? Promise.resolve();
	const next = before
		.catch(() => {})
		.then(async () => {
			const lock = join(git.dir, 'harness-planning.lock');
			try {
				await mkdir(lock);
			} catch {
				return fail('repository-busy', 'Another planning operation holds this repository');
			}
			try {
				git.transactionHead = await revision(git);
				return await work();
			} finally {
				await rm(lock, { recursive: true, force: true });
			}
		});
	queues.set(git.dir, next);
	try {
		return await next;
	} finally {
		if (queues.get(git.dir) === next) queues.delete(git.dir);
	}
}
export async function clean(git: Git, unitPath: string): Promise<void> {
	await safePath(git, unitPath);
	const artifactPaths = [
		`${unitPath}/plan.json`,
		`${unitPath}/designs`,
		`${unitPath}/threads`,
		`${unitPath}/.gitattributes`
	];
	await assertClean(git, artifactPaths);
}
export async function assertClean(git: Git, artifactPaths: string[]): Promise<void> {
	for (const path of artifactPaths) await safePath(git, path);
	const status = await git.run([
		'status',
		'--porcelain',
		'--untracked-files=all',
		'--ignored',
		'--',
		...artifactPaths
	]);
	if (status.length) fail('artifact-dirty', 'Planning artifacts contain uncommitted changes');
}
export async function commitFiles(
	git: Git,
	files: Files,
	message: string
): Promise<Omit<Committed<never>, 'value'>> {
	if (Object.keys(files).some((path) => path.endsWith('.png'))) await requireLfsFilters(git);
	const parent = await revision(git);
	if (parent !== git.transactionHead)
		fail('conflict', 'Repository changed during planning operation');
	const branch = (await git.run(['symbolic-ref', '--short', 'HEAD'])).toString().trim();
	if (!branch) fail('conflict', 'Writes require a checked-out branch');
	const temp = await mkdtemp(join(tmpdir(), 'planning-index-'));
	const index = join(temp, 'index');
	try {
		await git.run(['read-tree', parent], undefined, { GIT_INDEX_FILE: index });
		await stageFiles(git, files, index);
		const tree = (await git.run(['write-tree'], undefined, { GIT_INDEX_FILE: index }))
			.toString()
			.trim();
		const commit = (await git.run(['commit-tree', tree, '-p', parent, '-m', message]))
			.toString()
			.trim();
		await planCommit(git, files, { parent, branch, commit, temp });
		return { commit, parent, branch, paths: Object.keys(files) };
	} finally {
		await rm(temp, { recursive: true, force: true });
	}
}
