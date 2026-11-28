// @harness-uid u_uaeavhckin
import { realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { runTrackerHostCommand } from '../tracker-host-process-adapter/trackerHostCommand';
import type { TrackerHostStartRequest } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';

/**
 * Create a detached checkout for the attempt. The ops workdir, a macOS directory outside git and
 * a macOS route with `worktree: false` run in place. Any other git failure rejects the launch.
 */
export async function prepareTrackerWorkingDirectory(
	directory: string,
	input: TrackerHostStartRequest,
	signal: AbortSignal
): Promise<string | { failure: string }> {
	const source = realpathSync('workdir' in input ? input.workdir : input.repo);
	if (!statSync(source).isDirectory()) return { failure: `${source} is not a directory` };
	if ('workdir' in input) return source;
	const native = input.backend === 'native';
	if (native && input.worktree === false) return source;
	if (native && (await outsideGit(source, signal))) return source;
	const worktree = join(directory, 'worktree');
	const git = await trackerGit(
		source,
		['-c', 'core.hooksPath=/dev/null', 'worktree', 'add', '--detach', worktree, 'HEAD'],
		signal
	).catch((error: unknown) => {
		if (!(error instanceof Error)) throw error;
		throw new Error(`Git worktree add: ${error.message}`, { cause: error });
	});
	return git.code === 0
		? worktree
		: { failure: `could not create a worktree of ${source}: ${git.stderr}` };
}

// Only git's own "not a git repository" answer counts, for a directory with no .git of its own.
async function outsideGit(source: string, signal: AbortSignal) {
	if (statSync(join(source, '.git'), { throwIfNoEntry: false })) return false;
	const probe = await trackerGit(source, ['rev-parse', '--git-dir'], signal);
	return probe.code === 128 && probe.stderr.includes('not a git repository');
}

function trackerGit(source: string, args: string[], signal: AbortSignal) {
	return runTrackerHostCommand('/usr/bin/git', ['-C', source, ...args], signal);
}
