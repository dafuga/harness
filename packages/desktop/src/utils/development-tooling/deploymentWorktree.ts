import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitRead, gitRevision } from '../gitRead';

/** A task-owned detached checkout keeps builds off the user's branch and dirty files. */
export async function deploymentWorktree<T>(
	root: string,
	commit: string,
	work: (directory: string) => Promise<T>
): Promise<T> {
	const resolved = await gitRevision(root, commit);
	const temporary = await mkdtemp(join(tmpdir(), 'harness-deployment-'));
	const directory = join(temporary, 'source');
	let added = false;
	try {
		await gitRead(root, ['worktree', 'add', '--detach', directory, resolved]);
		added = true;
		return await work(directory);
	} finally {
		if (added) await gitRead(root, ['worktree', 'remove', '--force', directory]);
		await rm(temporary, { recursive: true, force: true });
	}
}
