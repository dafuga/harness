export interface Finding {
	unit: string;
	metric: string;
	status: string;
	baseline: number | null;
	measured: number | null;
}
