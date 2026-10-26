import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskWorktreeAdapter } from '../../../src/adapters/agents-providers/ModuleTaskWorktreeAdapter';
import { GitAdapter } from '../../../src/adapters/git-source-history/GitAdapter';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { observedTaskOperation } from '../../support/taskProfiles';
import manifest from '../../../specification/units/adapter.agents-providers-module-task-worktree.json';
test('submission checkpoint preserves source HEAD and both staged and unstaged work', async () => {
	const f = await moduleTaskFixture();
	try {
		const cwd = join(f.root, 'review');
		await f.git.run(['worktree', 'add', '--detach', cwd, f.source]);
		const git = new GitAdapter(cwd);
		await writeFile(join(cwd, 'src/orders.ts'), 'export const orders = 2;');
		await git.run(['add', 'src/orders.ts']);
		await writeFile(join(cwd, 'src/orders.ts'), 'export const orders = 3;');
		await writeFile(join(cwd, 'new.txt'), 'review context');
		const adapter = new ModuleTaskWorktreeAdapter(f.root);
		expect(await adapter.checkpoint({ cwd, source: f.source, paths: [] })).toBe(f.source);
		await expect(adapter.checkpoint({ cwd, source: '0'.repeat(40), paths: [] })).rejects.toThrow(
			'Task worktree source or repository changed.'
		);
		await expect(
			adapter.checkpoint({ cwd, source: f.source, paths: ['absent.txt'] })
		).rejects.toThrow();
		const foreign = await moduleTaskFixture();
		try {
			await expect(
				adapter.checkpoint({ cwd: foreign.root, source: foreign.source, paths: [] })
			).rejects.toThrow('Task worktree source or repository changed.');
		} finally {
			await foreign.dispose();
		}
		const checkpoint = await observedTaskOperation(
			'adapter.agents-providers-module-task-worktree',
			'snapshot-submission-with-private-index',
			() =>
				adapter.checkpoint({
					cwd,
					source: f.source,
					paths: ['src/orders.ts', 'new.txt']
				})
		);
		expect({
			committedOrders: await git.run(['show', checkpoint + ':src/orders.ts']),
			newFile: await git.run(['show', checkpoint + ':new.txt']),
			stagedOrders: await git.run(['show', ':src/orders.ts']),
			parentIsSource: (await git.run(['rev-parse', checkpoint + '^'])) === f.source,
			taskHeadIsSource: (await git.run(['rev-parse', 'HEAD'])) === f.source,
			sourceHeadUnchanged: (await f.git.run(['rev-parse', 'HEAD'])) === f.source
		}).toEqual(manifest.testing.cases[0].expected.value);
	} finally {
		await f.dispose();
	}
});
