import type { RunContext, CheckOutcome } from './CheckRunService.types';
export type { RunContext, CheckOutcome } from './CheckRunService.types';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { resourcePriority } from '../../../../../core/execution-runtimes/resourceTypes';
import { resourceEnvironment } from '../../../../../utils/execution-runtimes/resourceEnvironment';
import { resourceWork } from '../../../../../utils/execution-runtimes/resourceWork';
import { runIsolated, type IsolatedResult } from '../../../../../utils/run-isolated/runIsolated';
import type { PlannedCheck } from '../../../../../utils/verification-evidence/verifyPlan';
import { gatherCaptures } from './gatherCaptures';
import { readBrowserDiagnostics } from './readBrowserDiagnostics';

const maxLogBytes = 2_000_000;

/** Runs one check in its own process group under a hard limit and collects what it captured. */
export class CheckRunService {
	constructor(private readonly context: RunContext) {}

	async run(check: PlannedCheck): Promise<CheckOutcome> {
		const { directory, commit } = this.context;
		const slug = check.id.replace(/[^\w.-]+/g, '-');
		const leaf = check.scenario ? check.name : slug;
		const evidencePath = `evidence/${commit}/${check.scenario ?? 'checks'}/${leaf}`;
		const result = await this.execute(check, evidencePath, slug);
		// Nothing a stopped check wrote is trusted: a timeout yields no captures at all.
		const captures = result.timedOut
			? { gathered: [], failures: [] }
			: gatherCaptures(join(directory, evidencePath), evidencePath);
		const prefix = check.scenario ? `${check.scenario}: ` : '';
		const written = captures.failures.map((failure) => `${prefix}check ${check.name} ${failure}`);
		const diagnostics = result.timedOut
			? {}
			: readBrowserDiagnostics(join(directory, evidencePath));
		const passed = result.status === 'passed' && !diagnostics.failure;
		if (diagnostics.failure) written.push(`${prefix}check ${check.name}: ${diagnostics.failure}`);
		return {
			check,
			passed,
			entry: this.entry(check, result, diagnostics),
			gathered: captures.gathered,
			failures: [...outcomeFailures(check, result).map((failure) => prefix + failure), ...written]
		};
	}

	private execute(
		check: PlannedCheck,
		evidencePath: string,
		slug: string
	): Promise<IsolatedResult> {
		const { directory } = this.context;
		return resourceWork(
			{
				priority: resourcePriority.parse(
					this.context.env.HARNESS_RESOURCE_PRIORITY ?? 'environment'
				)
			},
			(context) =>
				runIsolated({
					command: 'sh',
					args: ['-c', check.command],
					cwd: join(this.context.snapshot, check.cwd),
					env: {
						...this.environment(check, join(directory, evidencePath)),
						...resourceEnvironment(context.env)
					},
					onSpawn: context.track,
					timeoutMs: check.timeoutMs,
					log: join(directory, 'logs', `${slug}.log`),
					maxLogBytes
				}),
			this.context.env
		);
	}

	/** What a declared tool says it is: the first line it prints, or undefined when it fails. */
	async version(tool: { id: string; command: string }): Promise<string | undefined> {
		const log = join(this.context.directory, 'logs', `tool-${tool.id}.log`);
		const result = await runIsolated({
			command: 'sh',
			args: ['-c', tool.command],
			cwd: this.context.snapshot,
			env: { ...this.context.env },
			timeoutMs: 60_000,
			log,
			maxLogBytes
		});
		if (result.status !== 'passed') return undefined;
		const printed = await readFile(log, 'utf8').catch(() => '');
		return printed
			.split('\n')
			.find((line) => line.trim() !== '')
			?.trim();
	}

	private entry(
		check: PlannedCheck,
		result: IsolatedResult,
		diagnostics: ReturnType<typeof readBrowserDiagnostics>
	): CheckOutcome['entry'] {
		return {
			id: check.id,
			kind: check.kind,
			runner: check.runner,
			target: check.target,
			status: result.status === 'passed' && !diagnostics.failure ? 'passed' : 'failed',
			...(diagnostics.browserErrors ? { browserErrors: diagnostics.browserErrors } : {}),
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

/** What became of the processes a check left: stopped, signalled in vain, left alone, not known. */
function leftRunning(name: string, result: IsolatedResult): string[] {
	const stopped = result.stopped ?? result.survivors.length;
	const resisted = result.resisted ?? 0;
	const kept = result.survivors.length - stopped - resisted;
	const some = (count: number) => `${count} ${count === 1 ? 'process' : 'processes'}`;
	const were = (count: number) => (count === 1 ? 'it was' : 'they were');
	const lines = [
		`test ${name} left ${some(stopped)} running after it ended; ${were(stopped)} stopped`,
		`test ${name} left ${some(resisted)} running after it ended; ${were(resisted)} signalled and did not end`,
		`test ${name} left ${some(kept)} running that may belong to a shared service or could not be shown to be its own; ${were(kept)} not signalled and may still run`,
		`test ${name} left processes that could not be established; nothing more was signalled`
	];
	const said = [stopped > 0, resisted > 0, kept > 0, result.unknown === true];
	return lines.filter((_line, index) => said[index]);
}

function outcomeFailures(check: PlannedCheck, result: IsolatedResult): string[] {
	if (result.timedOut) return [`test ${check.name} timed out after ${check.timeoutMs} ms`];
	if (result.status === 'passed') return [];
	// Whatever the check itself reported, a process it left running is a failure of its own.
	const leaked = leftRunning(check.name, result);
	const failed =
		result.exitCode === 0
			? []
			: [`test ${check.name} failed with exit code ${result.exitCode ?? 'unknown'}`];
	return [...failed, ...leaked];
}
