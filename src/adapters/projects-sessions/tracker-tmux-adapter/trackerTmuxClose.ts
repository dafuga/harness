// @harness-uid u_fyf7e7kyi5
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TrackerRunReceipt } from '../../../services/agents-providers/TrackerDispatcherService.types';
import { attemptKey } from '../../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import { runTrackerHostCommand } from '../tracker-host-process-adapter/trackerHostCommand';
import {
	checkTrackerManagedReceipt,
	managedSessionName,
	trackerManagedToken
} from './trackerManagedLaunchReceipt';
import type { TrackerManagedReceipt } from './trackerManagedHostLauncher.types';
import { trackerSocket } from './trackerManagedWorkerProcess';
import { watchdogManualPrefix } from '../../../services/projects-sessions/WatchdogPaneService';
import type { TrackerTmuxClose, TrackerTmuxPane } from '../TrackerTmuxAdapter.types';
import { matchesTrackerTmuxPane, trackerPaneFormat, trackerSessionName } from './trackerTmuxPane';

const managedName = /^auto-[a-z0-9]{6,10}-r[1-9][0-9]*$/;

export function closePaneNames(input: TrackerTmuxClose) {
	const { pane, attempt, observed } = input;
	if (observed) return !attempt && watchdogManualPrefix(pane.name) ? trackerSessionName : null;
	if (!managedName.test(pane.name) || (attempt && !/^[a-f0-9]{64}$/.test(attempt))) return null;
	return managedName;
}

export function closePaneCandidate(input: TrackerTmuxClose, layouts: TrackerTmuxPane[]) {
	const { pane, observed } = input;
	return layouts.find(
		({ pane: candidate }) =>
			(candidate.runnerSocket || observed === true) &&
			!candidate.attached &&
			candidate.name === pane.name &&
			matchesTrackerTmuxPane(candidate, pane)
	);
}

/** Let the tmux server recheck the pane's identity and owner in the command that kills it. */
export async function killUnchangedPane(
	observed: TrackerTmuxPane,
	attempt: string | undefined,
	command: (args: string[]) => ReturnType<typeof runTrackerHostCommand>
): Promise<boolean> {
	const { id, raw } = observed;
	const identity = `#{==:${trackerPaneFormat},${raw}}`;
	const owner = `#{==:#{HARNESS_TRACKER_ATTEMPT},${attempt ?? ''}}`;
	const guard = `#{&&:${identity},${owner}}`;
	const closed = 'tracker-session-closed';
	const result = await command([
		'if-shell',
		'-F',
		'-t',
		id,
		guard,
		`display-message -p ${closed} ; kill-session -t ${id}`
	]);
	return result.code === 0 && result.stdout.trim() === closed;
}

export async function stopManagedRun(
	{ directory, tmux }: { directory: string; tmux: string },
	run: TrackerRunReceipt,
	signal: AbortSignal
): Promise<boolean> {
	const { node, item_id: itemId, id: runId } = run;
	const key = attemptKey(run);
	const token = trackerManagedToken(node, key);
	const name = managedSessionName(itemId, runId);
	const path = join(directory, token);
	const record = checkTrackerManagedReceipt(path, node, key);
	const probe = await managedTmuxEnvironment(tmux, node, name, signal);
	if (probe.code === 1 && missingTmuxSession(probe.stderr, name)) {
		if (matchesManagedStop(record, { itemId, runId, name })) requestResourceCleanup(path);
		return true;
	}
	if (
		probe.code !== 0 ||
		probe.stdout.trim() !== `HARNESS_TRACKER_ATTEMPT=${token}` ||
		!matchesManagedStop(record, { itemId, runId, name })
	)
		return false;
	// Recheck ownership inside the tmux server before terminating the exact session.
	const pane = await managedSessionPane(tmux, node, name, signal);
	if (!pane) return false;
	const result = await runTrackerHostCommand(
		tmux,
		[
			'-L',
			trackerSocket(node),
			'if-shell',
			'-F',
			'-t',
			pane,
			`#{&&:#{==:#{HARNESS_TRACKER_ATTEMPT},${token}},#{==:#{session_name},${name}}}`,
			`display-message -p tracker-session-stopped ; kill-session -t =${name}`
		],
		signal
	);
	if (result.code !== 0 || result.stdout.trim() !== 'tracker-session-stopped') return false;
	const after = await managedTmuxEnvironment(tmux, node, name, signal);
	const stopped = after.code === 1 && missingTmuxSession(after.stderr, name);
	if (stopped) requestResourceCleanup(path);
	return stopped;
}

async function managedSessionPane(tmux: string, node: string, name: string, signal: AbortSignal) {
	const result = await runTrackerHostCommand(
		tmux,
		['-L', trackerSocket(node), 'list-panes', '-s', '-t', `=${name}`, '-F', '#{pane_id}'],
		signal
	);
	const pane = result.stdout.split('\n')[0];
	return result.code === 0 && /^%[0-9]+$/.test(pane) ? pane : null;
}

function matchesManagedStop(
	record: TrackerManagedReceipt | undefined,
	{ itemId, runId, name }: { itemId: string; runId: number; name: string }
) {
	return record?.itemId === itemId && record.runId === runId && record.tmux === name;
}
export function managedTmuxEnvironment(
	tmux: string,
	node: string,
	name: string,
	signal: AbortSignal
) {
	return runTrackerHostCommand(
		tmux,
		['-L', trackerSocket(node), 'show-environment', '-t', `=${name}`, 'HARNESS_TRACKER_ATTEMPT'],
		signal
	);
}

export function missingTmuxSession(stderr: string, name: string): boolean {
	return (
		stderr.trim() === `no such session: =${name}` ||
		stderr.trim() === `can't find session: =${name}` ||
		/^(?:no server running on |no sessions$|error connecting to .+ \(No such file or directory\)$)/.test(
			stderr.trim()
		)
	);
}

function requestResourceCleanup(attempt: string) {
	const directory = join(attempt, 'hygiene');
	if (existsSync(directory)) writeFileSync(join(directory, 'closing'), '', { mode: 0o600 });
}
