import type { gameRuntimeMeasurements } from './game-measurements-fixture';

export type CaptureFacts = {
	state: string;
	viewport: string;
	timing: { navigation: number | null; stamp?: string | null };
	size: { width: number; height: number };
	measurements: ReturnType<typeof gameRuntimeMeasurements>;
};
