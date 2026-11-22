// @harness-uid u_nfctcgnv7g
export interface VideoSlot {
	unit: string;
	clipId: string;
	viewport: string;
	inputHash: string;
	testedRevision?: string;
	dependencies?: string[];
	reasons?: string[];
}

export interface VideoObservation {
	clipId: string;
	viewport: string;
	durationSeconds: number;
	states: { id: string; atSeconds: number }[];
	edges: { id: string; atSeconds: number }[];
	fresh?: boolean;
}

export interface VideoPlan {
	record: VideoSlot[];
	reuse: VideoSlot[];
}

export interface VideoGraphCoverage {
	graph: string;
	states: number;
	edges: number;
	clips?: number;
	complete: boolean;
	missing: string[];
}
