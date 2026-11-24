// @harness-uid u_bl6xl2h4a3
import type { z } from 'zod';
import type { WatchdogCli } from '../WatchdogPaneService.types';
import type { TrackerDispatchRunner } from '../TrackerDispatchSchedulerService.types';
import type {
	TrackerRunReceipt,
	TrackerReceiptUsage
} from '../../agents-providers/TrackerDispatcherService.types';
import type { TrackerTmuxAdapter } from '../../../adapters/projects-sessions/TrackerTmuxAdapter';
import type { TrackerHostRepository } from './nativeTrackerHostEffects.types';
import type { TaskSelection } from '../../../repositories/agents-providers/ModuleTaskRepository.types';
import type { hostSession, hostStart } from './trackerHostLaunchSchema';

export type TrackerHostSession = z.infer<typeof hostSession>;

export interface TrackerHostRouteItem {
	project?: string | null;
	agent?: string | null;
	repo?: string | null;
}

export type TrackerHostRoute = (item: TrackerHostRouteItem) => TrackerHostRepository | undefined;

export type TrackerHostStartReply = z.infer<typeof hostStart>;

export interface TrackerHostStartRequest extends TrackerHostRepository {
	node: string;
	itemId: string;
	runId: number;
	key: string;
	selection: TaskSelection;
	brief: string;
	backend: 'native' | 'docker';
	queuedAt: number;
}

export interface TrackerHostLaunchPort {
	inspect(
		input: { node: string; keys: readonly string[] },
		signal: AbortSignal
	): Promise<TrackerHostSession[]>;
	start(input: TrackerHostStartRequest, signal: AbortSignal): Promise<TrackerHostStartReply>;
	readUsage?(run: TrackerRunReceipt, signal: AbortSignal): Promise<TrackerReceiptUsage | undefined>;
	confirmNeverStarted?: TrackerDispatchRunner['confirmNeverStarted'];
}

export interface TrackerHostRunnerOptions {
	tmux?: TrackerTmuxAdapter;
	legacyRunDirectory?: string;
	now?: () => number;
}

export interface CompletedTrackerPaneRun {
	id: number;
	itemId: string;
	cli: WatchdogCli;
	auto: string | null;
	attempt: number;
	sessionId: string | null;
	endedAt: number;
	statusClock: string | null;
}
