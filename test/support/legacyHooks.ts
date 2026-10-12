/**
 * What earlier versions of Harness left in a repository, kept here in full and derived from
 * nothing: a test of what is installed today must still know what was installed before.
 */

/** The pre-push wrapper as Harness wrote it at b4afb74, when a push was the only stage. */
export const legacyPrePush = [
	'#!/bin/sh',
	'# harness-managed hook: pre-push. Written by "harness hooks install"; remove it with',
	'# "harness hooks uninstall". A hook that was already here is kept beside this file and',
	'# runs first.',
	'hook_dir=$(dirname "$0")',
	'input=$(cat)',
	"newline='",
	"'",
	'chained="$hook_dir/pre-push.harness-chained"',
	'if [ -x "$chained" ]; then',
	'\tprintf \'%s\' "${input:+$input$newline}" | "$chained" "$@" || exit $?',
	'fi',
	'git_dir=$(git rev-parse --absolute-git-dir 2>/dev/null) || exit 0',
	'[ -f "$git_dir/harness-hooks" ] || exit 0',
	'harness=$(cat "$git_dir/harness-hooks")',
	'printf \'%s\' "${input:+$input$newline}" | sh -c "$harness hooks run pre-push"',
	''
].join('\n');

/**
 * The commit-msg wrapper of the first release with a second stage (05e2f24). It asks the file
 * a worktree was given for pushes, so it starts the Harness of every worktree that ever opted
 * into pushes, whatever that Harness offers.
 */
export const firstMessageHook = [
	'#!/bin/sh',
	'# harness-managed hook: commit-msg. Written by "harness hooks install"; remove it with',
	'# "harness hooks uninstall". A hook that was already here is kept beside this file and',
	'# runs first.',
	'hook_dir=$(dirname "$0")',
	'chained="$hook_dir/commit-msg.harness-chained"',
	'if [ -x "$chained" ]; then',
	'\t"$chained" "$@" || exit $?',
	'fi',
	'git_dir=$(git rev-parse --absolute-git-dir 2>/dev/null) || exit 0',
	'[ -f "$git_dir/harness-hooks" ] || exit 0',
	'harness=$(cat "$git_dir/harness-hooks")',
	'sh -c "$harness hooks run commit-msg \\"\\$1\\"" harness-hook "$1" </dev/null',
	''
].join('\n');

/**
 * Stands in for the command line of the Harness of b4afb74. It writes down what it was started
 * with, lets a push through, and refuses every other stage with the words that Harness used.
 */
export const legacyCommandLine = (log: string): string =>
	[
		'#!/bin/sh',
		`printf '%s\\n' "$*" >> '${log}'`,
		'[ "$1 $2" = "hooks run" ] || exit 0',
		'if [ "$3" != "pre-push" ]; then',
		'\techo "Error: Unsupported hook stage \\"$3\\"; only pre-push is offered." >&2',
		'\texit 1',
		'fi',
		'cat > /dev/null',
		''
	].join('\n');
