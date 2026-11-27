import { execFile } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import { ProcessIdentityAdapter } from '../../../services/agents-providers/agent-activity-service/ProcessIdentityAdapter';
import { startHygieneChild, waitForHygiene } from './hygieneChild';
import { sweepHygiene } from './hygieneCleanup';
import { isClosing, markResource, writeHygieneJson } from './hygieneLedger';

const exec = promisify(execFile);

export async function startHygieneWatch(directory: string, worker: number, maxMinutes: number) {
	const start = new ProcessIdentityAdapter().find(worker).startedAt;
	if (!start || !Number.isInteger(maxMinutes) || maxMinutes < 1 || maxMinutes > 10_080)
		throw new Error('Could not establish the Tracker worker identity or run limit.');
	await startHygieneChild(['_watch', String(worker), start, String(maxMinutes)]);
	if (!(await waitForHygiene(() => existsSync(join(directory, 'watching')), 5000)))
		throw new Error('The Tracker resource supervisor did not start.');
}

export async function watchHygiene(
	directory: string,
	worker: number,
	start: string,
	minutes: number
) {
	const marker = join(directory, 'watching');
	writeFileSync(marker, String(process.pid), { flag: 'wx', mode: 0o600 });
	try {
		await watchWorker(directory, worker, start, minutes);
	} catch {
		writeHygieneJson(join(directory, 'cleanup.json'), {
			remaining: ['unverified run resource ledger']
		});
		await reportHygiene('The resource supervisor could not verify the run ledger.');
	} finally {
		unlinkSync(marker);
	}
}

async function watchWorker(directory: string, worker: number, start: string, minutes: number) {
	const deadline = performance.now() + minutes * 60_000;
	while (!isClosing(directory) && workerWasNotReplaced(worker, start)) {
		if (performance.now() >= deadline && (await stopOnTimeout(directory))) break;
		await Bun.sleep(1500);
	}
	if (!existsSync(directory)) return;
	const remaining = await sweepHygiene(directory);
	if (remaining.length) {
		// Retry services that were busy or handling creation when the pane disappeared.
		await Bun.sleep(2500);
		const afterRetry = await sweepHygiene(directory);
		if (afterRetry.length)
			await reportHygiene('Cleanup could not confirm closure of ' + afterRetry.join(', ') + '.');
	}
}

function workerWasNotReplaced(worker: number, start: string) {
	const identity = new ProcessIdentityAdapter().find(worker);
	return identity.exists !== false && (!identity.startedAt || identity.startedAt === start);
}

async function stopOnTimeout(directory: string) {
	const {
		HARNESS_TRACKER_TMUX: tmux,
		HARNESS_TRACKER_SOCKET: socket,
		HARNESS_TRACKER_PANE: pane
	} = process.env;
	const attempt = readFileSync(join(dirname(directory), 'started'), 'utf8').trim();
	if (
		!tmux ||
		!isAbsolute(tmux) ||
		!socket ||
		!pane ||
		!/^auto-[a-z0-9]{6}-r[1-9][0-9]*$/.test(pane) ||
		!/^[a-f0-9]{64}$/.test(attempt)
	)
		return false;
	const command = [
		'-L',
		socket,
		'if-shell',
		'-F',
		'-t',
		'=' + pane + ':',
		'#{==:#{HARNESS_TRACKER_ATTEMPT},' + attempt + '}',
		'display-message -p tracker-hygiene-timed-out ; kill-session -t =' + pane
	];
	try {
		const { stdout } = await exec(tmux, command, { timeout: 5000 });
		if (stdout.trim() !== 'tracker-hygiene-timed-out') return false;
		markResource(directory, 'closing');
		await reportHygiene(
			'The configured run limit elapsed. Tracker stopped the managed session and started resource cleanup.'
		);
		return true;
	} catch {
		return false;
	}
}

async function reportHygiene(message: string) {
	const {
		TRACKER_ITEM_ID: item,
		TRACKER_RUN_ID: run,
		HARNESS_EXECUTABLE: executable
	} = process.env;
	if (!item || !run || !executable) return;
	await exec(
		executable,
		['tracker', 'note', item, 'Run #' + run + ' computer hygiene. ' + message],
		{
			timeout: 5000
		}
	).catch(() => undefined);
}
