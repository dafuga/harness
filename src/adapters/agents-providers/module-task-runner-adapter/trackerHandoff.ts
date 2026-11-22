// @harness-uid u_rw64iex44n
import { execFile } from 'node:child_process';
import { hostname, homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { GitAdapter } from '../../git-source-history/GitAdapter';
import type { TaskSessionMetric } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { TrackerHandoff } from './trackerHandoff.types';
import { ModuleTaskRunError } from '../ModuleTaskRunnerAdapter.types';

const exec = promisify(execFile);

/** Send only host-generated metadata. The agent's checkpoint stays in the worktree. */
export async function trackerHandoff(
	root: string,
	report: TrackerHandoff,
	session: TaskSessionMetric
): Promise<void> {
	const git = new GitAdapter(root);
	const [commit, label] = await Promise.all([
		git.run(['rev-parse', 'HEAD']),
		git.attempt(['symbolic-ref', '--short', 'HEAD'])
	]);
	const branch = label && /^[a-zA-Z0-9._/-]{1,120}$/.test(label) ? label : 'detached or unnamed';
	const next =
		session.status === 'rotated'
			? 'Harness will start a fresh session to reconcile the worktree, task queue and checkpoint evidence before continuing.'
			: 'Review the current checkpoint and evidence before relaunching.';
	const text = [
		`stopped: Harness ${report.role} ${session.status} at ${session.peakContextTokens ?? 'unknown'} active tokens`,
		`resume from: ${hostname()} ${root} on branch ${branch} at ${commit}.`,
		`Evidence and next steps: ${report.checkpoint}. Session metrics: ${report.evidence}.`,
		session.preRequestEstimateTokens === undefined
			? ''
			: `Refused provider request estimated at ${session.preRequestEstimateTokens} tokens before dispatch.`,
		next
	].join(' ');
	await recordTrackerNote(root, report.tracker, text);
}

/** Record host-generated run metadata with the existing Tracker transport. */
export async function recordTrackerNote(
	root: string,
	tracker: string,
	text: string
): Promise<void> {
	validateTrackerId(tracker);
	try {
		await exec('tracker', ['note', tracker, text], { cwd: root, timeout: 10000 });
	} catch (error) {
		if ((error as { code?: string }).code !== 'ENOENT') throw trackerFailure();
		try {
			await exec(join(homedir(), '.local/bin/tracker'), ['note', tracker, text], {
				cwd: root,
				timeout: 10000
			});
		} catch {
			throw trackerFailure();
		}
	}
}

export function validateTrackerId(id: string): string {
	if (!/^[a-z0-9]{6,32}$/.test(id)) throw new ModuleTaskRunError('Expected a Tracker item ID.');
	return id;
}

function trackerFailure(): Error {
	return new ModuleTaskRunError(
		'Could not record the orchestration handoff on Tracker. Local checkpoint and metrics are preserved.'
	);
}
