// @harness-uid u_fyf7e7kyi5
import { join } from 'node:path';
import { runTrackerHostCommand } from '../tracker-host-process-adapter/trackerHostCommand';
import type { TrackerHostStartRequest } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import type {
	TrackerManagedExec,
	TrackerManagedTarget,
	TrackerManagedReceipt
} from './trackerManagedHostLauncher.types';

export const workerScript = `#!/bin/sh
set -u
umask 077
run_dir=$1
token=$2
shift 2
printf '%s\\n' "$token" > "$run_dir/started.tmp" || exit 125
/bin/mv "$run_dir/started.tmp" "$run_dir/started" || exit 125
"$@"
result=$?
printf '%s\\n' "$result" > "$run_dir/exit.tmp"
/bin/mv "$run_dir/exit.tmp" "$run_dir/exit"
exit "$result"
`;

export async function launchTmux(
	{ tmux, trackerBin, trackerExecutable, worktree }: TrackerManagedTarget,
	receipt: TrackerManagedReceipt,
	execution: TrackerManagedExec,
	signal: AbortSignal
): Promise<void> {
	const { node, itemId, runId, token } = receipt;
	const { script, command, clientPath, guestAuthFile } = execution;
	const environment = [
		`HOME=${command.profile}`,
		`HARNESS_TRACKER_CONFIG=${clientPath}`,
		`HARNESS_EXECUTABLE=${trackerExecutable}`,
		'HARNESS_TRACKER_LEGACY_BIN=/dev/null/tracker',
		`TRACKER_ITEM_ID=${itemId}`,
		`TRACKER_RUN_ID=${runId}`,
		'TERM=xterm-256color',
		`PATH=${trackerBin}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`,
		...(command.image ? [`HARNESS_TASK_DOCKER_IMAGE=${command.image}`] : []),
		...(command.image && guestAuthFile ? [`HARNESS_TRACKER_GUEST_AUTH_FILE=${guestAuthFile}`] : [])
	];
	await runTrackerHostCommand(
		tmux,
		[
			'-f',
			'/dev/null',
			'-L',
			trackerSocket(node),
			'new-session',
			'-d',
			'-s',
			receipt.tmux,
			'-e',
			`HARNESS_TRACKER_ATTEMPT=${token}`,
			'-c',
			worktree,
			'/usr/bin/env',
			'-i',
			...environment,
			'/bin/sh',
			script,
			join(worktree, '..'),
			token,
			...command.argv
		],
		signal
	);
}

export function trackerSocket(node: string): string {
	return node === 'harbor-mbp-2' ? 'claude' : 'default';
}

export function managedBrief(input: TrackerHostStartRequest): string {
	const { backend, itemId, brief } = input;
	const source = Buffer.from(brief);
	if (backend !== 'docker' || source.length <= 15_900) return brief;
	const completion = brief.indexOf('## Completion and worktree cleanup');
	const finalInstructions = completion < 0 ? '' : brief.slice(completion);
	const header = source.subarray(0, 14_500).toString('utf8');
	return (
		header + '\n\nRead the full task with `tracker show ' + itemId + '`.\n\n' + finalInstructions
	);
}
