// @harness-uid u_fyf7e7kyi5
import { trackerSecretSafetyRule } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerSecretSafetyRule';
import { realpathSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runTrackerHostCommand } from '../tracker-host-process-adapter/trackerHostCommand';
import type { TrackerHostStartRequest } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import type {
	TrackerManagedExec,
	TrackerManagedTarget,
	TrackerManagedReceipt,
	TrackerManagedPresence
} from './trackerManagedHostLauncher.types';

import type { TrackerRunReceipt } from '../../../services/agents-providers/TrackerDispatcherService.types';
import { attemptKey } from '../../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import {
	checkTrackerManagedReceipt,
	hasManagedStartupEvidence,
	managedSessionName,
	trackerManagedToken
} from './trackerManagedLaunchReceipt';
import { managedTmuxEnvironment, missingTmuxSession } from './trackerTmuxClose';
import { trackerManagedProviderEnvironment } from './trackerManagedProviderCommands';

export const workerScript = `#!/bin/sh
set -u
umask 077
run_dir=$1
token=$2
shift 2
remove_guest_auth() {
	if [ "\${HARNESS_TRACKER_GUEST_AUTH_FILE:-}" = "$run_dir/guest-auth.json" ]; then
		/bin/rm -f "$run_dir/guest-auth.json"
	fi
}
trap 'remove_guest_auth' 0
printf '%s\\n' "$token" > "$run_dir/started.tmp" || exit 125
/bin/mv "$run_dir/started.tmp" "$run_dir/started" || exit 125
"$@"
result=$?
remove_guest_auth
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
		...Object.entries(trackerManagedProviderEnvironment(trackerBin, command)).map(
			([name, value]) => `${name}=${value}`
		),
		`HARNESS_TRACKER_CONFIG=${clientPath}`,
		`HARNESS_EXECUTABLE=${trackerExecutable}`,
		'HARNESS_TRACKER_LEGACY_BIN=/dev/null/tracker',
		`TRACKER_ITEM_ID=${itemId}`,
		`TRACKER_RUN_ID=${runId}`,
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
			dirname(script),
			token,
			...command.argv
		],
		signal
	);
}

/** Resolve the configured ops directory or create a detached checkout for the attempt. */
export async function prepareTrackerWorkingDirectory(
	directory: string,
	input: TrackerHostStartRequest,
	signal: AbortSignal
): Promise<string | null> {
	const source = realpathSync('workdir' in input ? input.workdir : input.repo);
	if (!statSync(source).isDirectory()) return null;
	if ('workdir' in input) return source;
	const worktree = join(directory, 'worktree');
	const git = await runTrackerHostCommand(
		'/usr/bin/git',
		[
			'-C',
			source,
			'-c',
			'core.hooksPath=/dev/null',
			'worktree',
			'add',
			'--detach',
			worktree,
			'HEAD'
		],
		signal
	);
	return git.code === 0 ? worktree : null;
}

export function trackerSocket(node: string): string {
	return node === 'harbor-mbp-2' ? 'claude' : 'default';
}

export function managedBrief(input: TrackerHostStartRequest): string {
	const { backend, itemId } = input;
	const brief = input.brief.startsWith(trackerSecretSafetyRule)
		? input.brief
		: trackerSecretSafetyRule + '\n\n' + input.brief.replace(trackerSecretSafetyRule + '\n\n', '');
	const source = Buffer.from(brief);
	if (backend !== 'docker' || source.length <= 15_900) return brief;
	const completion = brief.indexOf('## Completion and worktree cleanup');
	const finalInstructions = completion < 0 ? '' : brief.slice(completion);
	const pointer = '\n\nRead the full task with `tracker show ' + itemId + '`.\n\n';
	// The orchestrator refuses briefs over 16,000 bytes, so the final instructions come first.
	const room = 15_900 - Buffer.byteLength(pointer + finalInstructions);
	// Streaming decode drops a character cut in half; a replacement character would exceed the budget.
	const cut = source.subarray(0, Math.min(14_500, room));
	const header = new TextDecoder().decode(cut, { stream: true });
	return header + pointer + finalInstructions;
}

export async function confirmManagedStartupAbsent(
	{ directory, tmux }: { directory: string; tmux: string },
	run: TrackerRunReceipt,
	signal: AbortSignal
) {
	const { node, item_id: itemId, id: runId } = run;
	const key = attemptKey(run);
	const path = join(directory, trackerManagedToken(node, key));
	const name = managedSessionName(itemId, runId);
	const record = checkTrackerManagedReceipt(path, node, key);
	if (record && (record.itemId !== itemId || record.runId !== runId || record.tmux !== name))
		return false;
	const presence = await probeManagedTmuxSession({ tmux, node }, name, record?.token, signal);
	return presence === 'absent' && !hasManagedStartupEvidence(path);
}

export async function probeManagedTmuxSession(
	{ tmux, node }: { tmux: string; node: string },
	name: string,
	token: string | undefined,
	signal: AbortSignal
): Promise<TrackerManagedPresence> {
	const result = await managedTmuxEnvironment(tmux, node, name, signal);
	if (token && result.code === 0 && result.stdout.trim() === `HARNESS_TRACKER_ATTEMPT=${token}`)
		return 'live';
	return result.code === 1 && missingTmuxSession(result.stderr, name) ? 'absent' : 'unknown';
}
