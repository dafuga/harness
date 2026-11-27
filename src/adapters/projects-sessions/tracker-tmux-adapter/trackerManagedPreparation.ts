// @harness-uid u_bsvjwbzonk
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TrackerWorkerClient } from '../../../services/projects-sessions/tracker-native-runtime-service/nativeTrackerHostEffects.types';
import type { TrackerHostStartRequest } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import { managedSessionName, trackerManagedToken } from './trackerManagedLaunchReceipt';
import type { TrackerManagedReceipt } from './trackerManagedHostLauncher.types';
import { managedBrief, workerScript } from './trackerManagedWorkerProcess';
import { prepareTrackerWorkingDirectory } from './trackerManagedWorkingDirectory';
import { runTrackerHostCommand } from '../tracker-host-process-adapter/trackerHostCommand';
import { trackerGuestAuthFile, trackerWorkerClient } from './trackerWorkerClient';

/** Reserve the attempt directory, then write its checkout, brief, script and receipt. */
export function reserveLaunchDirectory(path: string): boolean {
	try {
		mkdirSync(path, { mode: 0o700 });
		return true;
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'EEXIST') return false;
		throw error;
	}
}

export async function prepareManagedLaunch(
	{ directory, script, briefPath }: { directory: string; script: string; briefPath: string },
	input: TrackerHostStartRequest,
	client: TrackerWorkerClient,
	signal: AbortSignal
) {
	const worktree = await prepareTrackerWorkingDirectory(directory, input, signal);
	if (typeof worktree !== 'string') return worktree;
	const receipt: TrackerManagedReceipt = {
		node: input.node,
		key: input.key,
		itemId: input.itemId,
		runId: input.runId,
		token: trackerManagedToken(input.node, input.key),
		tmux: managedSessionName(input.itemId, input.runId),
		issuedAt: Date.now(),
		...(input.backend === 'native' &&
			input.selection.provider === 'claude' && { checkClaudeStartup: true })
	};
	const detached = worktree === join(directory, 'worktree');
	if (!detached)
		writeFileSync(join(directory, 'working-directory'), worktree, { mode: 0o600, flag: 'wx' });
	const checkout = await checkoutInstructions(input, worktree, detached, signal);
	writeFileSync(briefPath, managedBrief(input, checkout), { mode: 0o600, flag: 'wx' });
	writeFileSync(script, workerScript, { mode: 0o600, flag: 'wx' });
	writeFileSync(join(directory, 'receipt.json'), JSON.stringify(receipt), {
		mode: 0o600,
		flag: 'wx'
	});
	return {
		receipt,
		worktree,
		clientPath: trackerWorkerClient(directory, client),
		guestAuthFile:
			input.backend === 'docker' ? trackerGuestAuthFile(directory, receipt, client) : undefined
	};
}

async function checkoutInstructions(
	input: TrackerHostStartRequest,
	cwd: string,
	detached: boolean,
	signal: AbortSignal
) {
	const location =
		detached && 'repo' in input
			? `The host created a private git worktree at ${cwd}, detached from the checkout at ${input.repo}. Create your branch in the task checkout with \`git switch -c <branch>\` and leave the source checkout to its owner.`
			: `This task runs in place at ${cwd}. Preserve other sessions’ changes.`;
	if (!('repo' in input)) return location;
	// Ask Git to match the owner locally. Only config key names can reach stdout.
	const remote = await runTrackerHostCommand(
		'/usr/bin/git',
		[
			'-C',
			cwd,
			'config',
			'--local',
			'--name-only',
			'--get-regexp',
			'^remote\\..*\\.(url|pushurl)$',
			'[:/][Gg][Rr][Ee][Yy][Mm][Aa][Ss][Ss]/'
		],
		signal
	);
	return remote.code === 0
		? location + '\nThis repository has a Greymass remote. Open a PR only.'
		: location;
}
