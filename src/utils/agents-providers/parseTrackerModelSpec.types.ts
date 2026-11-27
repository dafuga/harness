// @harness-uid u_b5x7mlx577
import type { TrackerPreferredProvider } from './resolvePreferredProvider.types';

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
		/** A provider preference or timed switch. Takes precedence over the old Claude-only window. */
		preferredProvider?: TrackerPreferredProvider;
	};
}

export interface TrackerLearningConfig {
	minSamples?: number;
	upBelow?: number;
	downAbove?: number;
}
