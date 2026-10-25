import { randomUUID } from 'node:crypto';
import type { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
/** Exchange the explicit task ref without merging conflicting claims or changing source branches. */
export async function syncTaskQueue(git: GitAdapter, ref: string, remote: string) {
	if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(remote))
		throw new Error('Use a configured Git remote name.');
	await git.run(['remote', 'get-url', remote]);
	const advertised = await git.run(['ls-remote', '--refs', remote, ref]),
		incoming = `refs/harness/task-sync/${randomUUID()}`;
	try {
		if (advertised) {
			await git.run(['fetch', '--no-tags', remote, `${ref}:${incoming}`]);
			const theirs = await git.run(['rev-parse', incoming]),
				ours = await git.attempt(['rev-parse', '--verify', ref]);
			if (ours && ours !== theirs) {
				const forward = await git.exec(['merge-base', '--is-ancestor', ours, theirs]);
				const ahead = await git.exec(['merge-base', '--is-ancestor', theirs, ours]);
				if (forward.code !== 0 && ahead.code !== 0)
					throw new Error(
						'Task queues diverged. Keep both histories; coordinate the queue owner before retrying.'
					);
				if (forward.code === 0) await git.run(['update-ref', ref, theirs, ours]);
			} else if (!ours) await git.run(['update-ref', ref, theirs, '0'.repeat(40)]);
		}
		if (await git.attempt(['rev-parse', '--verify', ref]))
			await git.run(['push', remote, `${ref}:${ref}`]);
		return { remote, commit: await git.attempt(['rev-parse', '--verify', ref]) };
	} finally {
		await git.attempt(['update-ref', '-d', incoming]);
	}
}
