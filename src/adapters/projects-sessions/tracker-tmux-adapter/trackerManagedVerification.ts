// @harness-uid u_fyf7e7kyi5
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join } from 'node:path';
import type { TrackerRunReceipt } from '../../../services/agents-providers/TrackerDispatcherService.types';
import { attemptKey } from '../../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerVerifyResult } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import { trackerManagedToken } from './trackerManagedLaunchReceipt';

const verifyTimeout = 30 * 60_000;
const keptOutput = 8 * 1024;
const drainGrace = 1000;

/** Run a configured verify command in the worktree of one managed attempt. */
export function trackerManagedVerification(directory: string) {
	return async (
		run: TrackerRunReceipt,
		command: string,
		signal: AbortSignal
	): Promise<TrackerVerifyResult> => {
		const token = trackerManagedToken(run.node, attemptKey(run));
		const worktree = join(directory, token, 'worktree');
		if (!existsSync(worktree)) return { code: 1, output: 'the run worktree is missing' };
		return runVerifyCommand(command, worktree, signal);
	};
}

/**
 * The command leads its own process group, which is killed on exit, timeout and shutdown. It gets
 * a clean login environment, so none of the Tracker service's variables reach the tested code.
 */
function runVerifyCommand(
	command: string,
	cwd: string,
	signal: AbortSignal
): Promise<TrackerVerifyResult> {
	signal.throwIfAborted();
	return new Promise((resolve, reject) => {
		const child = spawn('/bin/bash', ['-lc', command], {
			cwd,
			env: verifyEnvironment(),
			detached: true,
			stdio: ['ignore', 'pipe', 'pipe']
		});
		let output = '';
		const keep = (chunk: Buffer) => {
			output = (output + chunk.toString('utf8')).slice(-keptOutput);
		};
		child.stdout.on('data', keep);
		child.stderr.on('data', keep);
		const stop = () => killProcessGroup(child.pid);
		const timer = setTimeout(stop, verifyTimeout);
		signal.addEventListener('abort', stop, { once: true });
		const settle = (code: number) => {
			clearTimeout(timer);
			signal.removeEventListener('abort', stop);
			if (signal.aborted) reject(signal.reason);
			else resolve({ code, output });
		};
		child.once('error', () => settle(1));
		child.once('exit', () => {
			stop();
			// A descendant that left the group can hold the pipes open.
			setTimeout(() => (child.stdout.destroy(), child.stderr.destroy()), drainGrace).unref();
		});
		child.once('close', (code) => settle(code ?? 1));
	});
}

function killProcessGroup(pid: number | undefined) {
	if (!pid) return;
	try {
		process.kill(-pid, 'SIGKILL');
	} catch {
		// The group has already exited.
	}
}

function verifyEnvironment(): Record<string, string> {
	return {
		HOME: homedir(),
		USER: userInfo().username,
		PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'
	};
}
