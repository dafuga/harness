// @harness-uid u_fyf7e7kyi5
import { mkdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
	controlledTrackerExecutable,
	runTrackerHostCommand
} from '../tracker-host-process-adapter/trackerHostCommand';
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
	trackerManagedEvidence,
	trackerManagedToken
} from './trackerManagedLaunchReceipt';
import type { TrackerManagedReceipt } from './trackerManagedHostLauncher.types';
import {
	workerScript,
	launchTmux,
	managedBrief,
	trackerSocket
} from './trackerManagedWorkerProcess';
import { trackerWorkerClient } from './trackerWorkerClient';
import {
	privateTrackerDirectory,
	trackerManagedProviderCommand,
	validateManagedProfiles
} from './trackerManagedProviderCommands';

export function trackerManagedHostLauncher(
	config: TrackerManagedLaunchConfig,
	{
		client,
		platform = process.platform
	}: { client: TrackerWorkerClient; platform?: typeof process.platform }
): TrackerHostLaunchPort {
	const tmux = controlledTrackerExecutable(config.tmux);
	const directory = privateTrackerDirectory(config.stateDirectory);
	const trackerBin = realpathSync(config.trackerBinDirectory);
	const trackerExecutable = controlledTrackerExecutable(join(trackerBin, 'harness'));
	const profiles = validateManagedProfiles(config);

	return {
		async inspect({ node, keys }, signal) {
			const sessions = [];
			for (const key of keys) {
				const session = await inspectManagedSession({ directory, tmux, node, key }, signal);
				if (session) sessions.push(session);
			}
			return sessions;
		},
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
					{ script, command, clientPath: plan.clientPath },
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
	const repo = realpathSync(input.repo);
	if (!statSync(repo).isDirectory()) return null;
	const worktree = join(directory, 'worktree');
	const git = await runTrackerHostCommand(
		'/usr/bin/git',
		['-C', repo, '-c', 'core.hooksPath=/dev/null', 'worktree', 'add', '--detach', worktree, 'HEAD'],
		signal
	);
	if (git.code !== 0) return null;
	const receipt: TrackerManagedReceipt = {
		node: input.node,
		key: input.key,
		itemId: input.itemId,
		runId: input.runId,
		token: trackerManagedToken(input.node, input.key),
		tmux: `auto-${input.itemId.slice(0, 6)}-r${input.runId}`,
		issuedAt: Date.now()
	};
	writeFileSync(briefPath, managedBrief(input), { mode: 0o600, flag: 'wx' });
	writeFileSync(script, workerScript, { mode: 0o600, flag: 'wx' });
	writeFileSync(join(directory, 'receipt.json'), JSON.stringify(receipt), {
		mode: 0o600,
		flag: 'wx'
	});
	return { receipt, worktree, clientPath: trackerWorkerClient(directory, client) };
}

async function inspectManagedSession(
	{ directory, tmux, node, key }: { directory: string; tmux: string; node: string; key: string },
	signal: AbortSignal
) {
	const path = join(directory, trackerManagedToken(node, key));
	const record = checkTrackerManagedReceipt(path, node, key);
	if (!record) return undefined;
	const result = await runTrackerHostCommand(
		tmux,
		[
			'-L',
			trackerSocket(node),
			'show-environment',
			'-t',
			`=${record.tmux}`,
			'HARNESS_TRACKER_ATTEMPT'
		],
		signal
	);
	return trackerManagedEvidence(
		path,
		record,
		result.code === 0 && result.stdout.trim() === `HARNESS_TRACKER_ATTEMPT=${record.token}`
	);
}
