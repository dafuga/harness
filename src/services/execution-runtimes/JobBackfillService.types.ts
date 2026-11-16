// @harness-uid u_izz5miwhbq
export interface HistoricalResult {
	task?: string;
	unit?: string;
	unit_id?: string;
	model?: string;
	worker?: string;
	wave?: string;
	status?: string;
	seconds?: number;
	wall_minutes?: number;
	tasks?: { seconds?: number }[];
	tried?: { seconds?: number }[];
}
export interface BackfillResult {
	imported: number;
	duplicate: number;
	skipped: number;
	errors: string[];
}
