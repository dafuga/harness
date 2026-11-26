// @harness-uid u_bl6xl2h4a3
import { TrackerHostProcessAdapter } from '../../../adapters/projects-sessions/TrackerHostProcessAdapter';
import { trackerManagedHostLauncher } from '../../../adapters/projects-sessions/tracker-tmux-adapter/trackerManagedHostLauncher';
import type {
	TrackerHostLaunchConfig,
	TrackerWorkerClient
} from './nativeTrackerHostEffects.types';
import type {
	ClaudeStartupFailure,
	TrackerHostLaunchPort,
	TrackerHostSession,
	TrackerHostTarget
} from './trackerHostLaunch.types';
import type { TrackerReservedStart } from '../TrackerDispatchSchedulerService.types';
import { hostInventory, hostStart } from './trackerHostLaunchSchema';
import type { TrackerItemReadRepository } from '../../../repositories/projects-sessions/TrackerItemReadRepository';
import type {
	TrackerDispatchEvent,
	TrackerRunReceipt
} from '../../agents-providers/TrackerDispatcherService.types';

export function trackerHostLaunchPort(
	config: TrackerHostLaunchConfig,
	client?: TrackerWorkerClient,
	transcriptRoots?: readonly string[]
): TrackerHostLaunchPort {
	if ('managed' in config) {
		if (!client)
			throw new TypeError('Tracker managed launcher needs the verified local client address');
		return trackerManagedHostLauncher(config.managed, { client, transcriptRoots });
	}
	const driver = new TrackerHostProcessAdapter(config.driver);
	return {
		async inspect(input, signal) {
			return hostInventory.parse(await driver.request('inspect', input, signal));
		},
		async start(input, signal) {
			return hostStart.parse(await driver.request('start', input, signal));
		}
	};
}

export async function withTrackerRunUsage(
	event: TrackerDispatchEvent | undefined,
	{
		driver,
		run,
		items,
		now
	}: {
		driver: TrackerHostLaunchPort;
		run: TrackerRunReceipt;
		items: TrackerItemReadRepository;
		now: number;
	},
	signal: AbortSignal
): Promise<TrackerDispatchEvent | undefined> {
	if (event?.type !== 'monitor' || run.cli === 'none' || !driver.readUsage) return event;
	const status = trackerItemStatus(items, run.item_id);
	if (event.session === 'live' && withinActiveRunWindow(run, status, now)) return event;
	try {
		const usage = await driver.readUsage(run, signal);
		return usage ? { ...event, usage } : event;
	} catch {
		signal.throwIfAborted();
		return event;
	}
}

function withinActiveRunWindow(run: TrackerRunReceipt, status: string | null, now: number) {
	return (
		(status === 'open' || status === 'in_progress') &&
		now <= (run.eta_at ?? run.queued_at + 8 * 60 * 60_000)
	);
}

export function trackerItemStatus(items: TrackerItemReadRepository, id: string): string | null {
	try {
		return items.getStored(id).status;
	} catch {
		return null;
	}
}

export async function startTrackerHost(
	driver: TrackerHostLaunchPort,
	input: {
		node: string;
		route: TrackerHostTarget;
		reservation: TrackerReservedStart;
		brief: string;
		cpuBudget?: number;
		sessionName?: string;
	},
	signal: AbortSignal
): Promise<TrackerDispatchEvent | undefined> {
	const {
		node,
		route,
		reservation: { run, key, selection },
		brief,
		cpuBudget,
		sessionName
	} = input;
	const result = await driver.start(
		{
			node,
			itemId: run.item_id,
			runId: run.id,
			key,
			selection,
			brief,
			...route,
			backend: route.platform === 'macos' ? 'native' : 'docker',
			queuedAt: run.queued_at,
			...(cpuBudget && { cpuBudget }),
			sessionName
		},
		signal
	);
	if (result.status === 'rejected')
		return { type: 'startup-failed', reason: startupReason(result.reason, result.detail) };
	if (
		result.status === 'started' &&
		result.session.key === key &&
		result.session.itemId === run.item_id &&
		!result.session.legacyRunId
	)
		return trackerHostStartupEvent(result.session);
	return undefined;
}

export function trackerHostStartupEvent(
	session: TrackerHostSession | undefined
): TrackerDispatchEvent | undefined {
	if (!session) return undefined;
	return session.startupFailure
		? {
				type: 'startup-failed',
				reason: startupReason(session.startupFailure, session.diagnostic)
			}
		: { type: 'session', session };
}

function startupReason(failure?: ClaudeStartupFailure, detail?: string) {
	const reason = failure
		? claudeStartupMessage[failure]
		: 'Tracker host declined the reserved launch';
	return detail ? `${reason} (${detail})` : reason;
}

const claudeStartupMessage: Record<ClaudeStartupFailure, string> = {
	'claude-sign-in': 'Sign in to Claude Code on the target host before relaunching.',
	'claude-auth-unverified': 'Claude Code authentication could not be verified on the target host.',
	'claude-onboarding': 'Complete Claude Code onboarding on the target host before relaunching.',
	'claude-trust':
		'Trust this project folder in Claude Code on the target host (run claude once in the repository and accept the trust prompt) before relaunching.',
	'claude-not-ready': 'Claude Code did not reach its composer on the target host.'
};
