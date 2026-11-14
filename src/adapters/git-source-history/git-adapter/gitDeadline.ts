// @harness-uid u_pghy4246hw
import { commandDeadlines } from '../../execution-runtimes/BoundedCommandAdapter';

/** Global options whose value is the next argument, so that value is never read as the verb. */
const valued = new Set([
	'-c',
	'-C',
	'--git-dir',
	'--work-tree',
	'--namespace',
	'--exec-path',
	'--super-prefix',
	'--config-env',
	'--attr-source'
]);

/** Verbs that use the network or LFS, run hooks, rewrite a work tree, or walk every object. */
const long = new Set([
	'fetch',
	'pull',
	'push',
	'clone',
	'ls-remote',
	'lfs',
	'submodule',
	'worktree',
	'remote',
	'commit',
	'merge',
	'rebase',
	'checkout',
	'switch',
	'cherry-pick',
	'revert',
	'am',
	'reset',
	'restore',
	'stash',
	'archive',
	'bundle',
	'gc',
	'repack',
	'fsck',
	'maintenance'
]);

/** The git subcommand in an argument vector, after any global options. */
export function gitVerb(args: string[]): string | undefined {
	for (let index = 0; index < args.length; index += 1) {
		if (valued.has(args[index])) index += 1;
		else if (!args[index].startsWith('-')) return args[index];
	}
	return undefined;
}

/** The deadline of one git command: the long one when the verb is slow by nature or unknown. */
export function gitDeadline(args: string[]): number {
	const verb = gitVerb(args);
	return verb === undefined || long.has(verb)
		? commandDeadlines.longGitMs
		: commandDeadlines.localGitMs;
}
