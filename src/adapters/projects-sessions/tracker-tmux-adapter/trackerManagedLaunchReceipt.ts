// @harness-uid u_fyf7e7kyi5
import { createHash, randomUUID } from 'node:crypto';
import {
	closeSync,
	constants,
	fstatSync,
	openSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { runTrackerHostCommand } from '../tracker-host-process-adapter/trackerHostCommand';
import { claudeStartupFailure } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunchSchema';
import type {
	ClaudeStartupFailure,
	TrackerHostSession
} from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
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
	issuedAt: z.int().nonnegative(),
	checkClaudeStartup: z.literal(true).optional()
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

/** Where one attempt runs: its own worktree unless it recorded that it runs in place. */
export function trackerManagedWorkingDirectory(directory: string, node: string, key: string) {
	const attempt = join(directory, trackerManagedToken(node, key));
	return privateRecord(join(attempt, 'working-directory')) ?? join(attempt, 'worktree');
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

/** Keep a new Claude attempt queued until its own pane reaches the composer. */
export async function confirmManagedClaudeStartup(
	{
		path,
		receipt,
		tmux,
		socket,
		live
	}: {
		path: string;
		receipt: TrackerManagedReceipt;
		tmux: string;
		socket: string;
		live: boolean;
	},
	session: TrackerHostSession,
	signal: AbortSignal
): Promise<TrackerHostSession | undefined> {
	const marker = join(path, 'claude-startup');
	const recorded = privateRecord(marker);
	if (recorded === 'ready') return session;
	const result = recorded
		? claudeStartupFailure.parse(recorded)
		: await managedClaudeStartupPhase({ tmux, socket, live }, receipt, signal);
	if (!result) return undefined;
	if (!recorded) writeClaudeStartup(marker, result);
	if (result === 'ready') return session;
	if (live) await closeClaudeStartupPane(tmux, socket, receipt, signal);
	return { ...session, startupFailure: result };
}

async function managedClaudeStartupPhase(
	{ tmux, socket, live }: { tmux: string; socket: string; live: boolean },
	receipt: TrackerManagedReceipt,
	signal: AbortSignal
) {
	if (!live) return 'claude-not-ready';
	const result = await claudePaneStartup(tmux, socket, receipt.tmux, signal);
	if (result) return result;
	return Date.now() - receipt.issuedAt >= 120_000 ? 'claude-not-ready' : undefined;
}

function writeClaudeStartup(path: string, phase: string): void {
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		writeFileSync(temporary, phase, { mode: 0o600, flag: 'wx' });
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
}

async function claudePaneStartup(
	tmux: string,
	socket: string,
	name: string,
	signal: AbortSignal
): Promise<'ready' | ClaudeStartupFailure | undefined> {
	const { code, stdout } = await runTrackerHostCommand(
		tmux,
		['-L', socket, 'capture-pane', '-p', '-t', `=${name}:`],
		signal
	);
	if (code !== 0) return undefined;
	if (/^─{8}.*\n❯(?:[ \u00A0].*)?\n─{8}.*\n\s*(?:[⏵⏸]+\s|\? for shortcuts\b)/mu.test(stdout))
		return 'ready';
	if (/^\s*Choose the text style that looks best with your terminal/m.test(stdout))
		return 'claude-onboarding';
	if (/^\s*Select login method:/m.test(stdout)) return 'claude-sign-in';
	return undefined;
}

async function closeClaudeStartupPane(
	tmux: string,
	socket: string,
	receipt: TrackerManagedReceipt,
	signal: AbortSignal
) {
	await runTrackerHostCommand(
		tmux,
		[
			'-L',
			socket,
			'if-shell',
			'-F',
			'-t',
			`=${receipt.tmux}:`,
			`#{==:#{HARNESS_TRACKER_ATTEMPT},${receipt.token}}`,
			`kill-session -t =${receipt.tmux}`
		],
		signal
	);
}

export function managedSessionName(itemId: string, runId: number): string {
	return `auto-${itemId.slice(0, 6)}-r${runId}`;
}
