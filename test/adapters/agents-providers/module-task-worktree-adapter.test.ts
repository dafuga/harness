import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskWorktreeAdapter } from '../../../src/adapters/agents-providers/ModuleTaskWorktreeAdapter';
import { GitAdapter } from '../../../src/adapters/git-source-history/GitAdapter';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { observedTaskOperation } from '../../support/taskProfiles';
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
		const checkpoint = await observedTaskOperation(
			'adapter.agents-providers-module-task-worktree',
			'snapshot-submission-with-private-index',
			() =>
				new ModuleTaskWorktreeAdapter(f.root).checkpoint({
					cwd,
					source: f.source,
					paths: ['src/orders.ts', 'new.txt']
				})
		);
		expect(await git.run(['show', checkpoint + ':src/orders.ts'])).toContain('orders = 3');
		expect(await git.run(['show', checkpoint + ':new.txt'])).toBe('review context');
		expect(await git.run(['show', ':src/orders.ts'])).toContain('orders = 2');
		expect(await git.run(['rev-parse', 'HEAD'])).toBe(f.source);
		expect(await f.git.run(['rev-parse', 'HEAD'])).toBe(f.source);
	} finally {
		await f.dispose();
	}
});
