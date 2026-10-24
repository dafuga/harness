import type { RegressionPhase } from '../../../core/verification-evidence/regressionTypes';
import type { RegressionRecord } from '../../../core/verification-evidence/regressionTypes';
import type { runIsolated } from '../../../utils/reports-media/run-isolated/runIsolated';

export interface RegressionRun {
	commit: string;
	loop: string;
	phase: RegressionPhase;
	tests: string[];
	units: string[];
	knownUnits?: string[];
	command: string;
	assertion: string;
	timeoutMs: number;
	red?: RegressionRecord;
}

export interface Observation {
	profile: string;
	startedAt: string;
	result: Awaited<ReturnType<typeof runIsolated>>;
	output: Buffer;
	measurements: NonNullable<RegressionRecord['measurements']>;
	captures: NonNullable<RegressionRecord['captures']>;
	files: Array<{ path: string; bytes: Buffer }>;
}
