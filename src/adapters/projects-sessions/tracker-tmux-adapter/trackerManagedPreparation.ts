// @harness-uid u_bsvjwbzonk
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TrackerWorkerClient } from '../../../services/projects-sessions/tracker-native-runtime-service/nativeTrackerHostEffects.types';
import type { TrackerHostStartRequest } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import { managedSessionName, trackerManagedToken } from './trackerManagedLaunchReceipt';
import type { TrackerManagedReceipt } from './trackerManagedHostLauncher.types';
import { managedBrief, workerScript } from './trackerManagedWorkerProcess';
import { prepareTrackerWorkingDirectory } from './trackerManagedWorkingDirectory';
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
	if (worktree !== join(directory, 'worktree'))
		writeFileSync(join(directory, 'working-directory'), worktree, { mode: 0o600, flag: 'wx' });
	mkdirSync(join(directory, 'hygiene'), { mode: 0o700 });
	writeFileSync(briefPath, managedBrief(input), { mode: 0o600, flag: 'wx' });
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
