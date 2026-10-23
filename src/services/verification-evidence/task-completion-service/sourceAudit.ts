import { CommitTreeAdapter } from '../../../adapters/git-source-history/CommitTreeAdapter';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { loopPaths, readLoop } from '../../../workflows/development-tooling/loop-state/loopState';
import type { TaskAuditInput } from '../TaskCompletionService';

/** Only loop bookkeeping may change while source and the declared task stay committed. */
export async function sourceAudit(root: string, input: TaskAuditInput): Promise<string> {
	if (!['coding', 'planning'].includes(input.kind) || !input.goal.trim())
		throw new Error('Declare a coding or planning task and its goal.');
	if (input.loop && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.loop))
		throw new Error('Invalid task loop name.');
	const git = new GitAdapter(root);
	const commit = await git.run(['rev-parse', '--verify', 'HEAD^{commit}']);
	const metadata = input.loop ? await loopMetadata(root, commit, input) : [];
	const dirty = await git.bytes(['status', '--porcelain', '-z', '--untracked-files=all']);
	const changes = dirty.toString('utf8').split('\0').filter(Boolean);
	if (changes.some((line) => !metadata.includes(line.slice(3))))
		throw new Error(
			'Commit the task source and preserve unrelated edits before its completion audit.'
		);
	return commit;
}

async function loopMetadata(
	root: string,
	commit: string,
	input: TaskAuditInput
): Promise<string[]> {
	const path = `specification/loops/${input.loop}/loop.json`;
	const tree = await CommitTreeAdapter.open(root, commit);
	const committed = JSON.parse(await tree.read(path));
	const current = await readLoop(loopPaths(root, input.loop!).state);
	if (committed.goal !== input.goal || committed.goal !== current.goal)
		throw new Error('Commit the task goal before its completion audit.');
	if (JSON.stringify(committed.completion) !== JSON.stringify(current.completion))
		throw new Error('Commit the task kind and plan before its completion audit.');
	if (
		committed.completion &&
		(committed.completion.kind !== input.kind || committed.completion.plan !== input.plan)
	)
		throw new Error('Audit the committed task kind and plan.');
	return [path, `specification/loops/${input.loop}/trace.ndjson`];
}
