import type { Measurement } from '../src/core/verificationTypes';

export interface Bench {
	contract: string;
	profile: {
		id: string;
		platform: string;
		arch: string;
		cpu: string;
		cores: number;
		runtime: string;
	};
	source: { commit: string | null; dirty: boolean };
	workloads: Array<{ id: string; nodes: number; edges: number; requestBytes: number }>;
	measurements: Measurement[];
	default: { runtime: string; basis: string; workload: string; rule: string };
}
