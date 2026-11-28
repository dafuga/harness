// @harness-uid u_fyf7e7kyi5
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { controlledTrackerExecutable } from '../tracker-host-process-adapter/trackerHostCommand';
import type { TrackerManagedLaunchConfig } from '../../../services/projects-sessions/tracker-native-runtime-service/nativeTrackerHostEffects.types';
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
	trackerManagedToken
} from './trackerManagedLaunchReceipt';
import type {
	TrackerManagedLauncherOptions,
	TrackerManagedStartBindings
} from './trackerManagedHostLauncher.types';
import { prepareManagedLaunch, reserveLaunchDirectory } from './trackerManagedPreparation';
import { trackerManagedUsage } from './trackerManagedUsage';
import { trackerStartupCause } from './trackerStartupCause';
import { trackerManagedVerification } from './trackerManagedVerification';
import {
	confirmManagedStartupAbsent,
	probeManagedTmuxSession,
	launchTmux,
	trackerSocket
} from './trackerManagedWorkerProcess';
import { stopManagedRun } from './trackerTmuxClose';
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
		readUsage: trackerManagedUsage(
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
	if (needsClaudeAuth(input, runDirectory)) {
		const reason = await trackerClaudeAuthProblem(trackerBin, command, signal);
		if (reason) return { status: 'rejected', reason };
	}
	let refusal: string | undefined;
	if (reserveLaunchDirectory(runDirectory)) {
		const plan = await prepareManagedLaunch(
			{ directory: runDirectory, script, briefPath },
			input,
			client,
			signal
		);
		if ('failure' in plan) return { status: 'rejected', detail: trackerStartupCause(plan.failure) };
		const target = { tmux, trackerBin, trackerExecutable, worktree: plan.worktree };
		refusal = await launchTmux(
			{ ...target, windowName: input.sessionName },
			plan.receipt,
			{ ...plan, script, command, cpuBudget: input.cpuBudget },
			signal
		);
	}
	const session = await inspectManagedSession(
		{ directory, tmux, node: input.node, key: input.key },
		signal
	);
	// tmux can fail after the worker ran, so its refusal only counts without a session.
	if (!session && refusal) throw new Error(refusal);
	return managedStartReply(session);
}

function managedStartReply(session: TrackerHostSession | undefined): TrackerHostStartReply {
	if (session?.startupFailure)
		return {
			status: 'rejected',
			reason: session.startupFailure,
			...(session.diagnostic && { detail: session.diagnostic })
		};
	return session ? { status: 'started', session } : { status: 'pending' };
}

function needsClaudeAuth({ backend, selection }: TrackerHostStartRequest, runDirectory: string) {
	return backend === 'native' && selection.provider === 'claude' && !existsSync(runDirectory);
}

function validStartInput(input: TrackerHostStartRequest): boolean {
	return (
		/^[a-z0-9]{6,10}$/.test(input.itemId) && Number.isSafeInteger(input.runId) && input.runId > 0
	);
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
	const socket = trackerSocket(node, record.socket);
	const presence = await probeManagedTmuxSession(
		{ tmux, socket },
		record.tmux,
		record.token,
		signal
	);
	const session = trackerManagedEvidence(path, record, presence);
	return session && record.checkClaudeStartup
		? confirmManagedClaudeStartup(
				{ path, receipt: record, tmux, socket, live: presence === 'live' },
				session,
				signal
			)
		: session;
}
