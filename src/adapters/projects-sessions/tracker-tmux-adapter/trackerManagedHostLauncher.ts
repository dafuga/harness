// @harness-uid u_fyf7e7kyi5
import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { controlledTrackerExecutable } from '../tracker-host-process-adapter/trackerHostCommand';
import type {
	TrackerManagedLaunchConfig,
	TrackerWorkerClient
} from '../../../services/projects-sessions/tracker-native-runtime-service/nativeTrackerHostEffects.types';
import type {
	TrackerHostLaunchPort,
	TrackerHostStartReply,
	TrackerHostSession,
	TrackerHostStartRequest
} from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import {
	checkTrackerManagedReceipt,
	confirmManagedClaudeStartup,
	trackerManagedEvidence,
	managedSessionName,
	trackerManagedToken
} from './trackerManagedLaunchReceipt';
import type {
	TrackerManagedLauncherOptions,
	TrackerManagedStartBindings,
	TrackerManagedReceipt
} from './trackerManagedHostLauncher.types';
import { trackerManagedCodexUsage } from './trackerManagedCodexUsage';
import { trackerManagedVerification } from './trackerManagedVerification';
import {
	confirmManagedStartupAbsent,
	probeManagedTmuxSession,
	workerScript,
	launchTmux,
	managedBrief,
	prepareTrackerWorkingDirectory,
	trackerSocket
} from './trackerManagedWorkerProcess';
import { stopManagedRun } from './trackerTmuxClose';
import { trackerGuestAuthFile, trackerWorkerClient } from './trackerWorkerClient';
import {
	privateTrackerDirectory,
	trackerClaudeAuthProblem,
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
		verify: trackerManagedVerification(directory),
		stop: (run, signal) => stopManagedRun({ directory, tmux }, run, signal),
		confirmNeverStarted: (run, signal) =>
			confirmManagedStartupAbsent({ directory, tmux }, run, signal),
		start: (input, signal) =>
			startManagedSession(
				{ directory, tmux, trackerBin, trackerExecutable, profiles, platform, client },
				input,
				signal
			)
	};
}

async function startManagedSession(
	{
		directory,
		tmux,
		trackerBin,
		trackerExecutable,
		profiles,
		platform,
		client
	}: TrackerManagedStartBindings,
	input: TrackerHostStartRequest,
	signal: AbortSignal
): Promise<TrackerHostStartReply> {
	const token = trackerManagedToken(input.node, input.key);
	const runDirectory = join(directory, token);
	const script = join(runDirectory, 'launch.sh');
	const briefPath = join(runDirectory, 'brief.md');
	const command = trackerManagedProviderCommand(profiles, input, briefPath, platform);
	if (!command || !validStartInput(input)) return { status: 'rejected' };
	if (
		input.backend === 'native' &&
		input.selection.provider === 'claude' &&
		!existsSync(runDirectory)
	) {
		const reason = await trackerClaudeAuthProblem(trackerBin, command, signal);
		if (reason) return { status: 'rejected', reason };
	}
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
			{ ...plan, script, command, cpuBudget: input.cpuBudget },
			signal
		);
	}
	const session = await inspectManagedSession(
		{ directory, tmux, node: input.node, key: input.key },
		signal
	);
	return managedStartReply(session);
}

function managedStartReply(session: TrackerHostSession | undefined): TrackerHostStartReply {
	if (session?.startupFailure) return { status: 'rejected', reason: session.startupFailure };
	return session ? { status: 'started', session } : { status: 'pending' };
}

function validStartInput(input: TrackerHostStartRequest): boolean {
	return (
		/^[a-z0-9]{6,10}$/.test(input.itemId) && Number.isSafeInteger(input.runId) && input.runId > 0
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
		issuedAt: Date.now(),
		...(input.backend === 'native' &&
			input.selection.provider === 'claude' && { checkClaudeStartup: true })
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
	const socket = trackerSocket(node);
	const presence = await probeManagedTmuxSession({ tmux, node }, record.tmux, record.token, signal);
	const session = trackerManagedEvidence(path, record, presence);
	return session && record.checkClaudeStartup
		? confirmManagedClaudeStartup(
				{ path, receipt: record, tmux, socket, live: presence === 'live' },
				session,
				signal
			)
		: session;
}
