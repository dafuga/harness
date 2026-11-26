// @harness-uid u_ltornfrpah
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import type { TrackerRecurringJobReceipt } from '../../../services/projects-sessions/TrackerRecurringService.types';
import type { JobCommand } from './runTrackerJobCommand.types';
import { redactTrackerJobOutput } from '../../../utils/projects-sessions/redactTrackerJobOutput';
import { commandEnvironment } from '../../execution-runtimes/BoundedCommandAdapter';
import { trackerJobStateDirectory } from './trackerJobReceipts';

const keptBytes = 8192;
const drainGrace = 1000;
const shutdown = 'interrupted: Tracker shut down while the job was running';
const nice = ['/usr/bin/nice', '/bin/nice'].find((path) => existsSync(path));

/**
 * `/bin/sh` at low priority in the item's state directory. The command leads its own process
 * group, which is killed on exit, timeout and shutdown. The service's own variables are withheld.
 */
export async function runTrackerJobCommand(
	directory: string,
	job: JobCommand,
	signal: AbortSignal
): Promise<TrackerRecurringJobReceipt> {
	if (signal.aborted) return { code: 1, timedOut: false, output: shutdown };
	const state = trackerJobStateDirectory(directory, job.item_id);
	mkdirSync(state, { recursive: true, mode: 0o700 });
	return collectJob(spawnJob(state, job), job.timeout_s, signal);
}

function spawnJob(state: string, { cmd, item_id, occurrence }: JobCommand) {
	const shell = ['/bin/sh', '-c', cmd];
	const [binary, ...args] = nice ? [nice, '-n', '10', ...shell] : shell;
	return spawn(binary, args, {
		cwd: state,
		env: commandEnvironment({
			TRACKER_ITEM_ID: item_id,
			TRACKER_OCCURRENCE: occurrence,
			TRACKER_STATE_DIR: state
		}),
		detached: true,
		stdio: ['ignore', 'pipe', 'pipe']
	});
}

function collectJob(
	child: ChildProcess,
	timeoutSeconds: number,
	signal: AbortSignal
): Promise<TrackerRecurringJobReceipt> {
	return new Promise((resolve) => {
		const output = keptOutput(child);
		const stop = () => killProcessGroup(child.pid);
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			stop();
		}, timeoutSeconds * 1000);
		signal.addEventListener('abort', stop, { once: true });
		const settle = (code: number) => {
			clearTimeout(timer);
			signal.removeEventListener('abort', stop);
			if (signal.aborted) resolve({ code: 1, timedOut: false, output: shutdown });
			else resolve({ code, timedOut, output: redactTrackerJobOutput(output()) });
		};
		child.once('error', () => settle(127));
		child.once('exit', () => {
			stop();
			// A descendant that left the group can hold the pipes open.
			setTimeout(() => (child.stdout?.destroy(), child.stderr?.destroy()), drainGrace).unref();
		});
		child.once('close', (code) => settle(code ?? 128));
	});
}

/** The first bytes of both streams, in arrival order. */
function keptOutput(child: ChildProcess): () => string {
	const chunks: Buffer[] = [];
	let size = 0;
	const keep = (chunk: Buffer) => {
		const kept = chunk.subarray(0, keptBytes - size);
		chunks.push(kept);
		size += kept.length;
	};
	child.stdout?.on('data', keep);
	child.stderr?.on('data', keep);
	return () => Buffer.concat(chunks).toString('utf8');
}

function killProcessGroup(pid: number | undefined) {
	if (!pid) return;
	try {
		process.kill(-pid, 'SIGKILL');
	} catch {
		// The group has already exited.
	}
}
