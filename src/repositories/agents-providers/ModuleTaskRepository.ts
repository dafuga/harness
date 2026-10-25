import type { ModuleTaskQueue } from './ModuleTaskRepository.types';
import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import { stableJson } from '../../utils/development-tooling/stableJson';
import { queueSchema } from './module-task-repository/taskSchemas';
import { syncTaskQueue } from './module-task-repository/syncTaskQueue';
import { taskOwner } from './module-task-repository/taskOwner';
export { featureSchema, taskInputSchema } from './module-task-repository/taskSchemas';
/** A Git-committed queue shared by this repository's worktrees; source and index are untouched. */
export class ModuleTaskRepository {
	private readonly git: GitAdapter;
	readonly ref = 'refs/harness/tasks';
	constructor(readonly root: string) {
		this.git = new GitAdapter(root);
	}
	async read() {
		const commit = await this.git.attempt(['rev-parse', '--verify', this.ref]);
		const data = commit
			? JSON.parse(await this.git.run(['show', `${commit}:queue.json`]))
			: { schemaVersion: 1, features: [], tasks: [] };
		return { commit, data: queueSchema.parse(data) };
	}
	async update<T>(change: (data: ModuleTaskQueue) => T, source?: string) {
		for (let attempt = 0; attempt < 16; attempt++) {
			const before = await this.read(),
				after = JSON.parse(stableJson(before.data)) as ModuleTaskQueue;
			const value = change(after),
				text = stableJson(queueSchema.parse(after));
			if (text === stableJson(before.data)) return { value, commit: before.commit };
			const next = await this.commit(text, before.commit, source);
			const swapped = await this.git.exec([
				'update-ref',
				this.ref,
				next,
				before.commit ?? '0'.repeat(40)
			]);
			if (swapped.code === 0) return { value, commit: next };
		}
		throw new Error('Task queue changed repeatedly; retry the operation.');
	}
	async sync(remote: string) {
		return syncTaskQueue(this.git, this.ref, remote);
	}
	owner() {
		return taskOwner(this.git);
	}
	private async commit(text: string, previous?: string, source?: string) {
		const blob = await this.git.run(['hash-object', '-w', '--stdin'], { input: text });
		const tree = await this.git.run(['mktree'], { input: `100644 blob ${blob}\tqueue.json\n` });
		const parents = [
			...new Set(
				[
					previous,
					source ?? (previous ? undefined : await this.git.run(['rev-parse', 'HEAD']))
				].filter((x): x is string => Boolean(x))
			)
		];
		return this.git.run(['commit-tree', tree, ...parents.flatMap((p) => ['-p', p])], {
			input: 'chore: record Harness module task queue\n'
		});
	}
}
