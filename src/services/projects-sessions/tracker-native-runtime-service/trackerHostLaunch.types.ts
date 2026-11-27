// @harness-uid u_bl6xl2h4a3
import type { WatchdogPane } from '../WatchdogPaneService.types';
import type { z } from 'zod';
import type { TrackerLadderConfig } from '../../../utils/agents-providers/parseTrackerModelSpec.types';
import type { TrackerPersistenceService } from '../TrackerPersistenceService';
import type { TrackerDispatchRunner } from '../TrackerDispatchSchedulerService.types';
import type {
	TrackerRunReceipt,
	TrackerReceiptUsage
} from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import type { TrackerHostRepository } from './nativeTrackerHostEffects.types';
import type { TaskSelection } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { claudeStartupFailure, hostSession, hostStart } from './trackerHostLaunchSchema';

export type ClaudeStartupFailure = z.infer<typeof claudeStartupFailure>;

export type TrackerHostSession = z.infer<typeof hostSession>;

export interface TrackerHostDispatchSettings {
	now: () => number;
	automaticEnabled?: () => boolean;
	ladderConfig?: TrackerLadderConfig;
}

export interface TrackerHostRouteItem {
	project?: string | null;
	agent?: string | null;
	repo?: string | null;
}

export type TrackerHostTarget = TrackerHostRepository | { workdir: string; platform: 'macos' };

export type TrackerHostRoute = (item: TrackerHostRouteItem) => TrackerHostTarget | undefined;

export interface TrackerHostLaunchContext {
	driver: TrackerHostLaunchPort;
	node: string;
	routeFor: TrackerHostRoute;
	store: TrackerPersistenceService;
}

export type TrackerHostStartReply = z.infer<typeof hostStart>;

export type TrackerHostStartRequest = TrackerHostTarget & {
	node: string;
	itemId: string;
	runId: number;
	key: string;
	selection: TaskSelection;
	brief: string;
	backend: 'native' | 'docker';
	queuedAt: number;
	/** Cores the session must stay within; it also runs at lower priority. */
	cpuBudget?: number;
	/** "Project: title" for the tmux window and Claude Remote Control. */
	sessionName?: string;
};

export interface TrackerHostLaunchPort {
	inspect(
		input: { node: string; keys: readonly string[] },
		signal: AbortSignal
	): Promise<TrackerHostSession[]>;
	start(input: TrackerHostStartRequest, signal: AbortSignal): Promise<TrackerHostStartReply>;
	readUsage?(run: TrackerRunReceipt, signal: AbortSignal): Promise<TrackerReceiptUsage | undefined>;
	/** Run a verify command in the attempt's own worktree. Rejects only when the signal aborts. */
	verify?(
		run: TrackerRunReceipt,
		command: string,
		signal: AbortSignal
	): Promise<TrackerVerifyResult>;
	stop?: TrackerDispatchRunner['stop'];
	confirmNeverStarted?: TrackerDispatchRunner['confirmNeverStarted'];
}

export interface TrackerVerifyResult {
	code: number;
	output: string;
}

export type TrackerHostVerifyCommand = (run: TrackerRunReceipt) => string | undefined;

export interface TrackerHostRunnerOptions {
	verifyCommand?: TrackerHostVerifyCommand;
	tmux?: TrackerTmuxAdapter;
	legacyRunDirectory?: string;
	now?: () => number;
	automaticEnabled?(): boolean;
}

export interface CompletedTrackerPaneRun {
	id: number;
	itemId: string;
	cli: 'codex' | 'claude';
	outcome: string | null;
	auto: string;
	attempt: number;
	sessionId: string | null;
	endedAt: number;
	itemClosed: number;
}

export interface TrackerSessionSweep {
	tmux: TrackerTmuxAdapter;
	panes: readonly WatchdogPane[];
	node: string;
	now: number;
}
