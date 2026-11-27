// @harness-uid u_r7qgepnoax
export interface TrackerInstructionsRepair {
	text: string;
	changed: boolean;
	notes: string[];
}

export interface TrackerInstructionsResult {
	file: string;
	status: 'current' | 'would update' | 'updated' | 'created';
	notes: string[];
}
