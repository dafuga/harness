/** Text that marks a hook file as written by Harness. */
export const hookMarker = 'harness-managed hook';
/** Suffix under which a hook that was already installed is kept, unchanged, and still run. */
export const chainedSuffix = '.harness-chained';
/** File in a worktree's own Git directory that turns the hook on for that worktree. */
export const enabledFile = 'harness-hooks';

/**
 * The hook wrapper. It first runs the hook that was there before, with the same arguments and
 * input, and stops if that fails. Harness then runs only in a worktree that opted in, using the
 * command that worktree recorded, so other worktrees of the repository behave as before.
 */
export function hookScript(stage: string): string {
	return [
		'#!/bin/sh',
		`# ${hookMarker}: ${stage}. Written by "harness hooks install"; remove it with`,
		'# "harness hooks uninstall". A hook that was already here is kept beside this file and',
		'# runs first.',
		'hook_dir=$(dirname "$0")',
		'input=$(cat)',
		"newline='",
		"'",
		`chained="$hook_dir/${stage}${chainedSuffix}"`,
		'if [ -x "$chained" ]; then',
		'\tprintf \'%s\' "${input:+$input$newline}" | "$chained" "$@" || exit $?',
		'fi',
		'git_dir=$(git rev-parse --absolute-git-dir 2>/dev/null) || exit 0',
		`[ -f "$git_dir/${enabledFile}" ] || exit 0`,
		`harness=$(cat "$git_dir/${enabledFile}")`,
		`printf '%s' "\${input:+$input$newline}" | sh -c "$harness hooks run ${stage}"`,
		''
	].join('\n');
}

/** True when a hook file is the Harness wrapper rather than someone else's hook. */
export function managedHook(text: string): boolean {
	return text.includes(hookMarker);
}
