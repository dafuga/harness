import type { UnitDetail } from '../src/cli/program/inspectUnits.types';

export interface Shown extends Pick<UnitDetail, 'tests' | 'testAttribution' | 'declarations'> {
	manifest: {
		id: string;
		contract: { inputs: Array<{ name: string; type: string; examples?: unknown[] }> };
		runtime: { kind: string; entry: string; targets: Array<{ kind: string; entry: string }> };
		lineage?: { predecessors: string[] };
		budgets: { performance: unknown[] };
	};
	version: { unit: string; manifest: string; source: string; contract: string; runtime: string };
}

export interface Labelled {
	responsibility: string;
	responsibilityOrigin: string;
}
