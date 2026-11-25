// @harness-uid u_fyf7e7kyi5
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TrackerRunReceipt } from '../../../services/agents-providers/TrackerDispatcherService.types';
import { attemptKey } from '../../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import { controlledTrackerExecutable } from '../tracker-host-process-adapter/trackerHostCommand';
import type {
	TrackerManagedLaunchConfig,
	TrackerWorkerClient
} from '../../../services/projects-sessions/tracker-native-runtime-service/nativeTrackerHostEffects.types';
import type {
	TrackerHostLaunchPort,
	TrackerHostStartRequest
} from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import {
	checkTrackerManagedReceipt,
	hasManagedStartupEvidence,
	trackerManagedEvidence,
	managedSessionName,
	managedTmuxEnvironment,
	missingTmuxSession,
	stopManagedRun,
	trackerManagedToken
} from './trackerManagedLaunchReceipt';
import type {
	TrackerManagedLauncherOptions,
	TrackerManagedReceipt
} from './trackerManagedHostLauncher.types';
import { trackerManagedCodexUsage } from './trackerManagedCodexUsage';
import {
	workerScript,
	launchTmux,
	managedBrief,
	prepareTrackerWorkingDirectory
} from './trackerManagedWorkerProcess';
import { trackerGuestAuthFile, trackerWorkerClient } from './trackerWorkerClient';
import {
	privateTrackerDirectory,
	trackerManagedProviderCommand,
	validateManagedProfiles
} from './trackerManagedProviderCommands';

export function trackerManagedHostLauncher(
	config: TrackerManagedLaunchConfig,
	options: TrackerManagedLauncherOptions
): TrackerHostLaunchPort {
	const { client, platform = process.platform, transcriptRoots = [] } = options;
	const tmux = controlledTrackerExecutable(config.tmux);
	const directory = privateTrackerDirectory(config.stateDirectory);
	const trackerBin = realpathSync(config.trackerBinDirectory);
	const trackerExecutable = controlledTrackerExecutable(join(trackerBin, 'harness'));
	const profiles = validateManagedProfiles(config);
	return {
		readUsage: trackerManagedCodexUsage(
			directory,
			platform === 'darwin' ? profiles.native?.profile : undefined,
			transcriptRoots
		),
		inspect: ({ node, keys }, signal) =>
			inspectManagedSessions({ directory, tmux, node, keys }, signal),
		stop: (run, signal) => stopManagedRun({ directory, tmux }, run, signal),
		confirmNeverStarted: (run, signal) =>
			confirmManagedStartupAbsent({ directory, tmux }, run, signal),
		async start(input, signal) {
			const token = trackerManagedToken(input.node, input.key);
			const runDirectory = join(directory, token);
			const script = join(runDirectory, 'launch.sh');
			const briefPath = join(runDirectory, 'brief.md');
			const command = trackerManagedProviderCommand(profiles, input, briefPath, platform);
			if (!command || !validStartInput(input)) return { status: 'rejected' };
			if (reserveLaunchDirectory(runDirectory)) {
				const plan = await prepareManagedLaunch(
					{ directory: runDirectory, script, briefPath },
					input,
					client,
					signal
				);
				if (!plan) return { status: 'rejected' };
				await launchTmux(
					{ tmux, trackerBin, trackerExecutable, worktree: plan.worktree },
					plan.receipt,
					{ script, command, clientPath: plan.clientPath, guestAuthFile: plan.guestAuthFile },
					signal
				);
			}
			const session = await inspectManagedSession(
				{ directory, tmux, node: input.node, key: input.key },
				signal
			);
			return session ? { status: 'started', session } : { status: 'pending' };
		}
	};
}

function validStartInput(input: TrackerHostStartRequest): boolean {
	return (
		/^[a-z0-9]{6,10}$/.test(input.itemId) && Number.isSafeInteger(input.runId) && input.runId > 0
	);
}

async function confirmManagedStartupAbsent(
	{ directory, tmux }: { directory: string; tmux: string },
	run: TrackerRunReceipt,
	signal: AbortSignal
) {
	const { node, item_id: itemId, id: runId } = run;
	const key = attemptKey(run);
	const path = join(directory, trackerManagedToken(node, key));
	const name = managedSessionName(itemId, runId);
	const record = checkTrackerManagedReceipt(path, node, key);
	if (record && (record.itemId !== itemId || record.runId !== runId || record.tmux !== name))
		return false;
	const probe = await managedTmuxEnvironment(tmux, node, name, signal);
	return (
		probe.code === 1 && missingTmuxSession(probe.stderr, name) && !hasManagedStartupEvidence(path)
	);
}

function reserveLaunchDirectory(path: string): boolean {
	try {
		mkdirSync(path, { mode: 0o700 });
		return true;
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'EEXIST') return false;
		throw error;
	}
}

async function prepareManagedLaunch(
	{ directory, script, briefPath }: { directory: string; script: string; briefPath: string },
	input: TrackerHostStartRequest,
	client: TrackerWorkerClient,
	signal: AbortSignal
) {
	const worktree = await prepareTrackerWorkingDirectory(directory, input, signal);
	if (!worktree) return null;
	const receipt: TrackerManagedReceipt = {
		node: input.node,
		key: input.key,
		itemId: input.itemId,
		runId: input.runId,
		token: trackerManagedToken(input.node, input.key),
		tmux: managedSessionName(input.itemId, input.runId),
		issuedAt: Date.now()
	};
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

async function inspectManagedSessions(
	{
		directory,
		tmux,
		node,
		keys
	}: { directory: string; tmux: string; node: string; keys: readonly string[] },
	signal: AbortSignal
) {
	const sessions = [];
	for (const key of keys) {
		const session = await inspectManagedSession({ directory, tmux, node, key }, signal);
		if (session) sessions.push(session);
	}
	return sessions;
}

async function inspectManagedSession(
	{ directory, tmux, node, key }: { directory: string; tmux: string; node: string; key: string },
	signal: AbortSignal
) {
	const path = join(directory, trackerManagedToken(node, key));
	const record = checkTrackerManagedReceipt(path, node, key);
	if (!record) return undefined;
	const result = await managedTmuxEnvironment(tmux, node, record.tmux, signal);
	const live =
		result.code === 0 && result.stdout.trim() === `HARNESS_TRACKER_ATTEMPT=${record.token}`;
	const absent = result.code === 1 && missingTmuxSession(result.stderr, record.tmux);
	const presence = live ? 'live' : 'unknown';
	return trackerManagedEvidence(path, record, absent ? 'absent' : presence);
}
