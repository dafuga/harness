import { join, relative } from 'node:path';
import type { VerificationRecord } from '../core/verificationTypes';
import { gatherCaptures, type Gathered } from '../utils/gatherCaptures';
import { runIsolated, type IsolatedResult } from '../utils/runIsolated';
import type { PlannedCheck } from '../utils/verifyPlan';

export interface RunContext {
	/** Clean export of the commit; every check runs inside it. */
	snapshot: string;
	/** Scratch directory of this run; evidence and logs are written beneath it. */
	directory: string;
	commit: string;
	tree: string;
	profile: string;
	env: Record<string, string | undefined>;
}

export interface CheckOutcome {
	check: PlannedCheck;
	passed: boolean;
	entry: VerificationRecord['tests'][number];
	gathered: Gathered[];
	failures: string[];
}

const maxLogBytes = 2_000_000;

/** Runs one check in its own process group under a hard limit and collects what it captured. */
export class CheckRunService {
	constructor(private readonly context: RunContext) {}

	async run(check: PlannedCheck): Promise<CheckOutcome> {
		const { directory, commit } = this.context;
		const slug = check.id.replace(/[^\w.-]+/g, '-');
		const leaf = check.scenario ? check.name : slug;
		const evidencePath = `evidence/${commit}/${check.scenario ?? 'checks'}/${leaf}`;
		const result = await runIsolated({
			command: 'sh',
			args: ['-c', check.command],
			cwd: join(this.context.snapshot, check.cwd),
			env: this.environment(check, join(directory, evidencePath)),
			timeoutMs: check.timeoutMs,
			log: join(directory, 'logs', `${slug}.log`),
			maxLogBytes
		});
		// Nothing a stopped check wrote is trusted: a timeout yields no captures at all.
		const captures = result.timedOut
			? { gathered: [], failures: [] }
			: gatherCaptures(join(directory, evidencePath), evidencePath);
		const prefix = check.scenario ? `${check.scenario}: ` : '';
		const written = captures.failures.map((failure) => `${prefix}check ${check.name} ${failure}`);
		return {
			check,
			passed: result.status === 'passed',
			entry: this.entry(check, result),
			gathered: captures.gathered,
			failures: [...outcomeFailures(check, result).map((failure) => prefix + failure), ...written]
		};
	}

	private entry(check: PlannedCheck, result: IsolatedResult): CheckOutcome['entry'] {
		return {
			id: check.id,
			kind: check.kind,
			runner: check.runner,
			target: check.target,
			status: result.status === 'passed' ? 'passed' : 'failed',
			durationMs: Math.round(result.durationMs),
			log: { ...result.log, path: relative(this.context.directory, result.log.path) }
		};
	}

	/** `harness verify` always requests captures; ordinary suites opt in with TAKE_SCREENSHOT. */
	private environment(check: PlannedCheck, evidence: string): Record<string, string | undefined> {
		return {
			...this.context.env,
			HARNESS_VERIFY: '1',
			TAKE_SCREENSHOT: '1',
			HARNESS_EVIDENCE_DIR: evidence,
			HARNESS_VERIFY_REVISION: this.context.commit,
			HARNESS_VERIFY_TREE: this.context.tree,
			HARNESS_VERIFY_PROFILE: this.context.profile,
			HARNESS_SCENARIO: check.scenario ?? '',
			HARNESS_ANALYTICS_DISABLED: '1'
		};
	}
}

function outcomeFailures(check: PlannedCheck, result: IsolatedResult): string[] {
	if (result.timedOut) return [`test ${check.name} timed out after ${check.timeoutMs} ms`];
	if (result.status === 'passed') return [];
	return [`test ${check.name} failed with exit code ${result.exitCode ?? 'unknown'}`];
}
