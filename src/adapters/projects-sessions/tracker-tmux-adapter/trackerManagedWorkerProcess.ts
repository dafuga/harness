// @harness-uid u_fyf7e7kyi5
import { trackerSecretSafetyRule } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerSecretSafetyRule';
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
import { trackerCpuBudgetEnvironment } from '../../../utils/projects-sessions/trackerCpuBudget';
import { trackerStartupCause } from './trackerStartupCause';

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
began=$(/bin/date +%s)
"$@"
result=$?
remove_guest_auth
# A launch that dies within a minute leaves its cause only on the pane, which is about to close.
if [ "$result" -ne 0 ] && [ -n "\${HARNESS_TRACKER_PANE:-}" ] && [ "$(($(/bin/date +%s) - began))" -le 60 ]; then
	"$HARNESS_TRACKER_TMUX" -L "$HARNESS_TRACKER_SOCKET" capture-pane -p -J -S -16 -t "=$HARNESS_TRACKER_PANE:" 2>/dev/null |
		/usr/bin/grep -iE '^[[:space:]]*(error|fatal):[[:space:]]' | /usr/bin/tail -n 1 |
		/usr/bin/head -c 500 > "$run_dir/startup-error"
fi
printf '%s\\n' "$result" > "$run_dir/exit.tmp"
/bin/mv "$run_dir/exit.tmp" "$run_dir/exit"
exit "$result"
`;

function launchEnvironment(
	{ tmux, trackerBin, trackerExecutable }: TrackerManagedTarget,
	{ node, itemId, runId, tmux: pane }: TrackerManagedReceipt,
	{ command, clientPath, guestAuthFile, cpuBudget }: TrackerManagedExec
) {
	return [
		...Object.entries(trackerManagedProviderEnvironment(trackerBin, command)).map(
			([name, value]) => `${name}=${value}`
		),
		`HARNESS_TRACKER_CONFIG=${clientPath}`,
		`HARNESS_EXECUTABLE=${trackerExecutable}`,
		'HARNESS_TRACKER_LEGACY_BIN=/dev/null/tracker',
		`TRACKER_ITEM_ID=${itemId}`,
		`TRACKER_RUN_ID=${runId}`,
		`HARNESS_TRACKER_TMUX=${tmux}`,
		`HARNESS_TRACKER_SOCKET=${trackerSocket(node)}`,
		`HARNESS_TRACKER_PANE=${pane}`,
		...(command.image ? [`HARNESS_TASK_DOCKER_IMAGE=${command.image}`] : []),
		...(command.image && guestAuthFile ? [`HARNESS_TRACKER_GUEST_AUTH_FILE=${guestAuthFile}`] : []),
		...(cpuBudget ? trackerCpuBudgetEnvironment(cpuBudget) : [])
	];
}

export async function launchTmux(
	target: TrackerManagedTarget,
	receipt: TrackerManagedReceipt,
	execution: TrackerManagedExec,
	signal: AbortSignal
): Promise<string | undefined> {
	const { tmux, worktree, windowName } = target;
	const { node, token } = receipt;
	const { script, command, cpuBudget } = execution;
	const environment = launchEnvironment(target, receipt, execution);
	// Outside the home project, lower priority lets Harbor win contention.
	const priority = cpuBudget ? ['/usr/bin/nice', '-n', '10'] : [];
	const created = await runTrackerHostCommand(
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
			...(windowName ? ['-n', windowName] : []),
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
			...priority,
			...command.argv
		],
		signal
	);
	return created.code === 0
		? undefined
		: trackerStartupCause(`tmux could not start the session: ${created.stderr}`);
}

export function trackerSocket(node: string): string {
	return node === 'harbor-mbp-2' ? 'claude' : 'default';
}

export function managedBrief(input: TrackerHostStartRequest, checkout?: string): string {
	const { backend, itemId } = input;
	const body = input.brief.startsWith(trackerSecretSafetyRule)
		? input.brief.slice(trackerSecretSafetyRule.length).trimStart()
		: input.brief.replace(trackerSecretSafetyRule + '\n\n', '');
	const brief = [trackerSecretSafetyRule, checkout, body].filter(Boolean).join('\n\n');
	const source = Buffer.from(brief);
	if (backend !== 'docker' || source.length <= 15_900) return brief;
	const completion = brief.lastIndexOf('## Completion and worktree cleanup');
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
