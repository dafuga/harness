import type { recordExampleCases } from '../support/recordExampleCases';

export type ScenarioSummary = { id: string; captures: number; unproven: number; excluded: number };

export type Invocation = { stdout: string[]; error?: unknown };

export type ExampleCase = Parameters<typeof recordExampleCases>[1][number];

export type CheckResult = {
	errors: string[];
	health: { coverage: { missing: number }; noScenario: { total: number } };
};
