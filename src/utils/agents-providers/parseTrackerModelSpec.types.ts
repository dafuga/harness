// @harness-uid u_b5x7mlx577
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
	};
}

export interface TrackerLearningConfig {
	minSamples?: number;
	upBelow?: number;
	downAbove?: number;
}
