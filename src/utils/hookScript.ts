/** Text that marks a hook file as written by Harness. */
export const hookMarker = 'harness-managed hook';
/** Suffix under which a hook that was already installed is kept, unchanged, and still run. */
export const chainedSuffix = '.harness-chained';
/**
 * File in a worktree's own Git directory that opts it into the push stage and holds its command.
 * Every version of Harness has written this one file, so it means a push and nothing else.
 */
export const enabledFile = 'harness-hooks';
/** The stages Harness offers: a push is verified, and the message of a commit is measured. */
export const hookStages = ['pre-push', 'commit-msg'] as const;
export type HookStage = (typeof hookStages)[number];

/**
 * The file that opts a worktree into one stage. The hooks directory is shared, so a stage that
 * is offered later is installed for worktrees that asked an earlier Harness for pushes only:
 * it has a file of its own, and is never started by the file of another stage.
 */
export function stageFile(stage: string): string {
	return stage === 'pre-push' ? enabledFile : `${enabledFile}-${stage}`;
}

/**
 * How a stage hands on what Git gave it. A push arrives as lines of input, which are read once
 * and given to the hook that was there and then to Harness. A commit message arrives as the path
 * of a file and no input at all: nothing reads input, and Harness is started with none.
 */
function passing(stage: string): { read: string[]; chained: string; harness: string } {
	if (stage === 'commit-msg') {
		const harness = `sh -c "$harness hooks run ${stage} \\"\\$1\\"" harness-hook "$1" </dev/null`;
		return { read: [], chained: '\t"$chained" "$@" || exit $?', harness };
	}
	const piped = 'printf \'%s\' "${input:+$input$newline}" |';
	return {
		read: ['input=$(cat)', "newline='", "'"],
		chained: `\t${piped} "$chained" "$@" || exit $?`,
		harness: `${piped} sh -c "$harness hooks run ${stage}"`
	};
}

/**
 * The hook wrapper. It first runs the hook that was there before, with the same arguments and
 * input, and stops if that fails. Harness then runs only in a worktree that opted into this
 * stage, using the command that worktree recorded for it, so other worktrees of the repository
 * behave as before.
 */
export function hookScript(stage: string): string {
	const { read, chained, harness } = passing(stage);
	const optIn = stageFile(stage);
	return [
		'#!/bin/sh',
		`# ${hookMarker}: ${stage}. Written by "harness hooks install"; remove it with`,
		'# "harness hooks uninstall". A hook that was already here is kept beside this file and',
		'# runs first.',
		'hook_dir=$(dirname "$0")',
		...read,
		`chained="$hook_dir/${stage}${chainedSuffix}"`,
		'if [ -x "$chained" ]; then',
		chained,
		'fi',
		'git_dir=$(git rev-parse --absolute-git-dir 2>/dev/null) || exit 0',
		`[ -f "$git_dir/${optIn}" ] || exit 0`,
		`harness=$(cat "$git_dir/${optIn}")`,
		harness,
		''
	].join('\n');
}

/** True when a hook file is the Harness wrapper rather than someone else's hook. */
export function managedHook(text: string): boolean {
	return text.includes(hookMarker);
}
