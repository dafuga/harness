// @harness-uid u_x7kddegtw2
import type { VerifyConfig } from '../../../../core/verification-evidence/verifyTypes';
import type { RunContext } from './check-run-service/CheckRunService';
import type { CheckOutcome } from './check-run-service/CheckRunService';
import type { BuiltArtifacts } from '../../../../utils/development-tooling/unitMeasurements';
import type { BuiltIdentity } from '../../../../services/verification-evidence/BuildIdentityService';
import type { RetainedArtifact } from '../../../../adapters/verification-evidence/snapshot-adapter/SnapshotAdapter.types';

export interface SnapshotRun {
	root: string;
	config: VerifyConfig;
	/** Everything about the run except the snapshot directory, which is created here. */
	context: Omit<RunContext, 'snapshot'>;
	/**
	 * The builds the run's scenarios need, as `neededBuilds` names them. A scoped run runs only
	 * the setup steps `scopedSetup` keeps, and identifies only the needed builds. `'all'`, or none
	 * given, runs and identifies everything.
	 */
	needed?: ReadonlySet<string> | 'all';
	retainArtifact?: string;
}

export interface Executed {
	outcomes: CheckOutcome[];
	/** Tracked files that setup or a check changed or deleted. */
	mutated: string[];
	/** Files that appeared outside the declared outputs. */
	added: string[];
	setupFailures: string[];
	/** Each declared tool with the version it reported in the snapshot. */
	tools: Array<{ id: string; version: string }>;
	/** Declared artifacts that exist in the snapshot after the run, by path. */
	artifacts: BuiltArtifacts;
	retainedArtifact?: RetainedArtifact;
	artifactFailures?: string[];
	/**
	 * Identity of each declared build the run needed, as setup compiled it; undefined when none is
	 * declared.
	 */
	builds?: BuiltIdentity[];
	/**
	 * Declared builds a scoped run did not need, so they were not identified. Absent when the run
	 * was not scoped.
	 */
	skippedBuilds?: string[];
	/** Declared builds that are missing, or whose files changed while checks ran. */
	buildFailures: string[];
}
