export interface VideoPilotMeasurementTarget {
	unit: string;
	clipId: string;
	state: string;
	buildId: string;
	viewport: { id: string; width: number; height: number };
}
