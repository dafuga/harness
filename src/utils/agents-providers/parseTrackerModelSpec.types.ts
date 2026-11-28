// @harness-uid u_b5x7mlx577
import type { TrackerTaskType } from './classifyTrackerTask.types';

export interface TrackerFlatPrice {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
}

export interface TrackerModelRung {
	id: string;
	cli: 'claude' | 'codex';
	model: string;
	effort: string;
	price: TrackerFlatPrice | null;
	pinned?: boolean;
}

export interface TrackerLadderConfig {
	autolaunch?: {
		ladder?: readonly (Partial<TrackerModelRung> & Pick<TrackerModelRung, 'id' | 'model'>)[];
		learning?: TrackerLearningConfig;
		/** ISO time of the Codex weekly reset; automatic routing is Claude-only before it. */
		claudeOnlyUntil?: string;
		/** The operator's task-type table; each list is the first model then its retry steps. */
		taskRoutes?: Partial<Record<TrackerTaskType, readonly string[]>>;
		/** Gemini joins hard escalation only when enabled and a launch route exists. */
		gemini?: { enabled?: boolean; model?: string };
	};
}

export interface TrackerLearningConfig {
	minSamples?: number;
	upBelow?: number;
	downAbove?: number;
}
