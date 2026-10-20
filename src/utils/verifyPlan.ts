import type { ScenarioManifest } from '../core/unitTypes';
import type { UnitsConfig } from '../core/unitsConfig';
import { type VerifyConfig } from '../core/verifyTypes';

export interface PlannedCheck {
	/** Unique within a run: a test path, or `scenario:test`. */
	id: string;
	scenario?: string;
	/** Short name used in messages. */
	name: string;
	kind: 'unit' | 'integration' | 'e2e';
	runner: 'vitest' | 'playwright' | 'command';
	target: string;
	/** Directory inside the snapshot the command runs in. */
	cwd: string;
	command: string;
	timeoutMs: number;
}

export interface PlanInput {
	selectedTests: string[];
	/** Scenarios whose checks must run for this revision. */
	scenarios: ScenarioManifest[];
	config: VerifyConfig;
	unitsConfig: UnitsConfig;
	testTimeoutMs?: number;
}

export { verifyPlan } from '../workflows/run-verify/verification-service/verifyPlan';
