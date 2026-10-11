import { spawn } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';
import { processDescendants, signalProcesses } from '../../src/utils/processDescendants';

const started: number[] = [];
const alive = (pid: number) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
afterEach(() => {
	for (const pid of started.splice(0)) if (alive(pid)) process.kill(pid, 'SIGKILL');
});

/** A parent that starts a daemon in its own session, says its id, and stays for a while. */
function parentOfDaemon(staysMs: number) {
	const script =
		'const child = require("child_process").spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], ' +
		'{ detached: true, stdio: "ignore" }); child.unref(); console.log(child.pid); ' +
		`setTimeout(() => process.exit(0), ${staysMs});`;
	const parent = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'ignore'] });
	const daemon = new Promise<number>((resolve) =>
		parent.stdout.once('data', (chunk: Buffer) => resolve(Number(chunk.toString())))
	);
	const ended = new Promise((resolve) => parent.once('exit', resolve));
	return { parent, daemon, ended };
}

test('a daemon is still known after its parent has ended, and only it is stopped', async () => {
	const { parent, daemon, ended } = parentOfDaemon(600);
	const tracker = processDescendants(parent.pid ?? -1);
	const pid = await daemon;
	started.push(pid);
	await tracker.look();
	await ended;
	const left = await tracker.survivors();
	expect(left.map((item) => item.pid)).toEqual([pid]);
	// The same id with another start time is another process: it is not signalled.
	await signalProcesses([{ pid, started: 'Thu Jan  1 00:00:00 1970' }], 'SIGKILL');
	await sleep(200);
	expect(alive(pid)).toBe(true);
	await signalProcesses(left, 'SIGKILL');
	await sleep(200);
	expect([alive(pid), await tracker.survivors()]).toEqual([false, []]);
});

test('what was never seen under the command is not followed', async () => {
	const { parent, daemon, ended } = parentOfDaemon(300);
	// Another command's tracker: this process tree is none of its business.
	const stranger = processDescendants(process.pid === parent.pid ? -1 : 2 ** 30);
	started.push(await daemon);
	await stranger.look();
	await ended;
	expect(await stranger.survivors()).toEqual([]);
});
