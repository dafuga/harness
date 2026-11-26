// @harness-uid u_bl6xl2h4a3
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { trackerCompletionVersion } from '../../../repositories/projects-sessions/tracker-dispatch-repository/dispatchItemFields';
import { attemptKey } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type {
	TrackerDispatchEvent,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService.types';
import type {
	TrackerHostLaunchPort,
	TrackerHostVerifyCommand,
	TrackerVerifyResult
} from './trackerHostLaunch.types';
import { trackerTranscriptMatches } from './trackerTranscriptPatterns';
import type { MonitorEvent, VerifiedEvent, VerifyJob } from './trackerHostVerification.types';

/**
 * Turn a finished item into verification events. Commands run in the background and are only
 * remembered in memory, so a verify interrupted by a restart runs again.
 */
export function trackerHostVerification(
	driver: TrackerHostLaunchPort,
	commandFor: TrackerHostVerifyCommand = () => undefined
) {
	const jobs = new Map<string, VerifyJob>();
	return {
		/** Stop commands whose run was reopened, replaced, stopped or finished. */
		retain(runs: readonly TrackerRunReceipt[]) {
			const wanted = new Set(runs.filter((run) => run.state === 'verifying').map(jobKey));
			for (const [key, job] of jobs) {
				if (wanted.has(key)) continue;
				job.cancel.abort();
				jobs.delete(key);
			}
		},
		event(
			event: TrackerDispatchEvent | undefined,
			{ run, database }: { run: TrackerRunReceipt; database: SqliteDatabase },
			signal: AbortSignal
		): TrackerDispatchEvent | undefined {
			if (event?.type !== 'monitor') return event;
			const command = commandFor(run);
			if (!command && run.state !== 'verifying') return event;
			const version = trackerCompletionVersion(database, run.item_id);
			if (!version) return event;
			if (run.state !== 'verifying' || run.verificationFor !== version)
				return { ...event, verify: true };
			// Without a command any more, the completion stands as it would have unverified.
			if (!command) return passed(event);
			const { verdict } = runningJob(jobs, { driver, run, command }, signal);
			return verdict && { ...verdict, usage: event.usage };
		}
	};
}

function runningJob(
	jobs: Map<string, VerifyJob>,
	{
		driver,
		run,
		command
	}: { driver: TrackerHostLaunchPort; run: TrackerRunReceipt; command: string },
	signal: AbortSignal
) {
	const key = jobKey(run);
	const job = jobs.get(key) ?? startJob(driver, { run, command }, signal);
	jobs.set(key, job);
	return job;
}

function passed({ usage }: MonitorEvent): VerifiedEvent {
	return { type: 'verified', passed: true, usage };
}

function jobKey(run: TrackerRunReceipt) {
	return JSON.stringify([attemptKey(run), run.verificationFor]);
}

function startJob(
	driver: TrackerHostLaunchPort,
	{ run, command }: { run: TrackerRunReceipt; command: string },
	signal: AbortSignal
): VerifyJob {
	const job: VerifyJob = { cancel: new AbortController() };
	const lifetime = AbortSignal.any([signal, job.cancel.signal]);
	const result = driver.verify
		? driver.verify(run, command, lifetime)
		: Promise.resolve({ code: 1, output: 'this host cannot run verify commands' });
	result.then(
		(finished) => (job.verdict = verdict(command, finished)),
		(error: Error) => {
			if (!lifetime.aborted) job.verdict = verdict(command, { code: 1, output: error.message });
		}
	);
	return job;
}

function verdict(command: string, { code, output }: TrackerVerifyResult) {
	if (code === 0) return { type: 'verified', passed: true } as const;
	return {
		type: 'verified',
		passed: false,
		reason: `tests failed: ${command} exited ${code}`,
		note: `auto-launch: tests failed after done (\`${command}\` exit ${code}): ${outputTail(output)}`
	} as const;
}

/** The last lines go into a synced note, so output that looks like a credential is withheld. */
function outputTail(output: string) {
	const [secret] = trackerTranscriptMatches(Buffer.from(output), 0);
	if (secret) return `[output withheld: it matched the ${secret.type} format]`;
	return output.trim().split('\n').slice(-5).join(' | ').slice(-300);
}
