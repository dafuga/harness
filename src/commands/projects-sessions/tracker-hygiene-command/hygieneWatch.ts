// @harness-uid u_fnb3unroyq
import { HygieneError } from './HygieneError';
import { execFile } from 'node:child_process';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ProcessIdentityAdapter } from '../../../services/agents-providers/agent-activity-service/ProcessIdentityAdapter';
import { startHygieneChild, waitForHygiene } from './hygieneChild';
import { hygienePane } from './hygienePane';
import { sweepHygiene } from './hygieneCleanup';
import { isClosing, markResource, writeHygieneJson } from './hygieneLedger';

const exec = promisify(execFile);

export async function startHygieneWatch(directory: string, worker: number, maxMinutes: number) {
	const start = new ProcessIdentityAdapter().find(worker).startedAt;
	if (!start || !Number.isInteger(maxMinutes) || maxMinutes < 1 || maxMinutes > 10_080)
		throw new HygieneError('Could not establish the Tracker worker identity or run limit.');
	await startHygieneChild(['_watch', String(worker), start, String(maxMinutes)]);
	if (!(await waitForHygiene(() => existsSync(join(directory, 'watching')), 5000)))
		throw new HygieneError('The Tracker resource supervisor did not start.');
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
	const pane = hygienePane(directory);
	while (existsSync(directory) && !isClosing(directory) && workerWasNotReplaced(worker, start)) {
		if ((await pane?.presence()) === 'gone') break;
		if (performance.now() >= deadline && (await pane?.timeout())) {
			markResource(directory, 'closing');
			await reportHygiene(
				'The configured run limit elapsed. Tracker stopped the managed session and started resource cleanup.'
			);
			break;
		}
		await Bun.sleep(1500);
	}
	await cleanupAfterWorker(directory);
}

async function cleanupAfterWorker(directory: string) {
	if (!existsSync(directory)) return;
	const remaining = await sweepHygiene(directory);
	if (remaining.length) {
		// Retry services that were busy or handling creation when the pane disappeared.
		await Bun.sleep(2500);
		const afterRetry = await sweepHygiene(directory);
		if (afterRetry.length) {
			const detail = afterRetry.join(', ').slice(0, 1500);
			await reportHygiene(
				'Cleanup could not confirm closure of ' +
					detail +
					'. See the attempt cleanup.json for the full list.'
			);
		}
	}
}

function workerWasNotReplaced(worker: number, start: string) {
	const identity = new ProcessIdentityAdapter().find(worker);
	return identity.exists !== false && (!identity.startedAt || identity.startedAt === start);
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
