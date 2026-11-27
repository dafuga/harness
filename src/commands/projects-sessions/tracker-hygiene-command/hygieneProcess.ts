import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { ProcessIdentityAdapter } from '../../../services/agents-providers/agent-activity-service/ProcessIdentityAdapter';
import { beginResource, isClosing, markResource, saveResource } from './hygieneLedger';
import { startHygieneChild, waitForHygiene } from './hygieneChild';

export async function openHygieneProcess(command: string[]) {
	if (!command[0]) throw new Error('Supply a foreground executable and its arguments.');
	const entry = beginResource({ kind: 'process' });
	const child = await startHygieneChild(['_process', entry], JSON.stringify(command));
	if (!(await waitForHygiene(() => existsSync(join(entry, 'ready')), 4000)))
		throw new Error('The run process group did not acknowledge start.');
	return { resource: basename(entry), pid: child };
}

/** Only the group leader itself can signal its group, even after the worker pane is gone. */
export async function holdHygieneProcess(entry: string, [program, ...args]: string[]) {
	process.on('SIGTERM', () => {});
	const pid = process.pid;
	const start = new ProcessIdentityAdapter().find(pid).startedAt;
	if (!start) throw new Error('Could not identify the run process group.');
	saveResource(entry, { kind: 'process', pid, start });
	if (!isClosing(entry)) {
		const child = spawn(program, args, { stdio: 'ignore' });
		await new Promise<void>((resolve, reject) => {
			child.once('spawn', resolve);
			child.once('error', reject);
		});
	}
	markResource(entry, 'ready');
	while (existsSync(entry) && !isClosing(entry)) await Bun.sleep(100);
	process.kill(-pid, 'SIGTERM');
	await Bun.sleep(400);
	process.kill(-pid, 'SIGKILL');
}

export async function closeHygieneProcess(entry: string, pid?: number, start?: string) {
	markResource(entry, 'closing');
	if (!pid || !start) throw new Error('The process group never confirmed its identity.');
	if (!(await waitForHygiene(() => groupGone(pid, start), 5000)))
		throw new Error('The process group is still present or its identity could not be checked.');
}

async function groupGone(pid: number, start: string) {
	const leader = new ProcessIdentityAdapter().find(pid);
	if (leader.exists === true && leader.startedAt !== start) return true;
	const { stdout } = await promisify(execFile)('/bin/ps', ['-ax', '-o', 'pgid=,stat='], {
		timeout: 2000,
		maxBuffer: 1 << 20
	});
	return !stdout.split('\n').some((line) => {
		const [group, state] = line.trim().split(/\s+/);
		return Number(group) === pid && state && !state.startsWith('Z');
	});
}
