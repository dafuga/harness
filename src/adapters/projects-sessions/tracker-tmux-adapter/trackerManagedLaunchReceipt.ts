// @harness-uid u_fyf7e7kyi5
import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TrackerRunReceipt } from '../../../services/agents-providers/TrackerDispatcherService.types';
import { attemptKey } from '../../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import { runTrackerHostCommand } from '../tracker-host-process-adapter/trackerHostCommand';
import { trackerSocket } from './trackerManagedWorkerProcess';
import { z } from 'zod';
import type { TrackerHostSession } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import type {
	TrackerManagedPresence,
	TrackerManagedReceipt
} from './trackerManagedHostLauncher.types';

const receiptSchema = z.strictObject({
	node: z.string(),
	runId: z.int().positive(),
	itemId: z.string().regex(/^[a-z0-9]{6,10}$/),
	key: z.string(),
	token: z.string().regex(/^[a-f0-9]{64}$/),
	tmux: z.string().regex(/^auto-[a-z0-9]{6}-r[0-9]+$/),
	issuedAt: z.int().nonnegative()
});

export function trackerManagedToken(node: string, key: string): string {
	return createHash('sha256')
		.update(JSON.stringify([node, key]))
		.digest('hex');
}

export function checkTrackerManagedReceipt(
	directory: string,
	node: string,
	key: string
): TrackerManagedReceipt | undefined {
	const text = privateRecord(join(directory, 'receipt.json'));
	if (text === undefined) return undefined;
	const record = receiptSchema.parse(JSON.parse(text));
	if (record.node !== node || record.key !== key || record.token !== trackerManagedToken(node, key))
		throw new TypeError('Tracker attempt receipt does not match its reservation');
	return record;
}

export function trackerManagedEvidence(
	directory: string,
	receipt: TrackerManagedReceipt,
	presence: TrackerManagedPresence
): TrackerHostSession | undefined {
	const phase = privateRecord(join(directory, 'started'))?.trim();
	if (phase !== receipt.token) return undefined;
	const exitCode = managedExitCode(join(directory, 'exit'));
	if (presence === 'unknown' && exitCode === undefined) return undefined;
	let state: TrackerHostSession['state'] = 'exited';
	if (exitCode === undefined) state = presence === 'absent' ? 'lost' : 'live';
	return {
		itemId: receipt.itemId,
		key: receipt.key,
		id: receipt.token,
		tmux: receipt.tmux,
		startedAt: receipt.issuedAt,
		state,
		exitCode
	};
}

export function hasManagedStartupEvidence(directory: string): boolean {
	return ['started', 'started.tmp', 'exit', 'exit.tmp'].some(
		(name) => privateRecord(join(directory, name)) !== undefined
	);
}

function managedExitCode(path: string): number | undefined {
	const exit = privateRecord(path)?.trim();
	if (exit === undefined) return undefined;
	if (!/^\d{1,3}$/.test(exit) || Number(exit) > 255)
		throw new TypeError('Invalid Tracker worker exit receipt');
	return Number(exit);
}

function privateRecord(path: string): string | undefined {
	const fd = openTrackerReceipt(path);
	if (fd === undefined) return undefined;
	try {
		const stat = fstatSync(fd);
		if (
			!stat.isFile() ||
			stat.nlink !== 1 ||
			stat.uid !== process.getuid?.() ||
			(stat.mode & 0o077) !== 0 ||
			stat.size > 8192
		)
			throw new TypeError('Tracker launch receipt must be a private regular file');
		return readFileSync(fd, 'utf8');
	} finally {
		closeSync(fd);
	}
}

function openTrackerReceipt(path: string): number | undefined {
	try {
		return openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
		throw error;
	}
}
export function managedSessionName(itemId: string, runId: number): string {
	return `auto-${itemId.slice(0, 6)}-r${runId}`;
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
	if (probe.code === 1 && missingTmuxSession(probe.stderr, name)) return true;
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
	return after.code === 1 && missingTmuxSession(after.stderr, name);
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
