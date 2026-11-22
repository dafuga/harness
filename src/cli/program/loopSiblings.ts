// @harness-uid u_bupajbnjit
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { InvalidArgumentError, type Command } from 'commander';
import { GitAdapter } from '../../adapters/git-source-history/GitAdapter';
import type { BugSweepReport } from '../../utils/development-tooling/siblingBugSweep.types';
import { siblingBugSweep } from '../../utils/development-tooling/siblingBugSweep';
import { reviewKnownClasses } from '../../utils/development-tooling/sibling-bug-sweep/reviewKnownClasses';
import { repairSiblings } from '../../workflows/development-tooling/sibling-bug-sweep/repairSibling';
import {
	beginSiblingReport,
	siblingReportComplete
} from '../../workflows/development-tooling/sibling-bug-sweep/loopSiblingReport';
import {
	assertLoopOpen,
	validateLoopId,
	type LoopState
} from '../../workflows/development-tooling/loop-state/loopState';
import { completeLoopStep, readLoopStatus } from './manageLoop';
import type { ReviewFlags, SiblingFlags } from './loopSiblings.types';

export function registerLoopSiblingCommands(parent: Command): void {
	addScanOptions(parent.command('siblings [loop]'))
		.description('Classify a reported bug and evaluate similar sites across committed source.')
		.option('--report <text>', 'Describe the symptom, trigger and suspected root cause.')
		.option('--class <id>', 'Reuse a class committed to the selected revision.')
		.option('--origin <path:line>', 'Exclude the original incident site.')
		.option('--report-only', 'Emit JSON without writing to the repository or launching workers.')
		.option('--repair', 'Dispatch isolated workers for confirmed sites.')
		.option(
			'--test-command <command>',
			'Trusted regression command that exercises each worker test.'
		)
		.option('--worker-model <model>', 'Codex worker model, defaulting to the evaluator model.')
		.action(runSiblingCommand);

	addScanOptions(parent.command('review-bugs <base>'))
		.description('Evaluate a committed change against bug classes from its merge base.')
		.action(runReviewCommand);
}

function addScanOptions(command: Command) {
	return command
		.option('--project <path>', 'Repository to read, defaulting to the current project.')
		.option('--commit <revision>', 'Committed source snapshot to scan.', 'HEAD')
		.option('--model <model>', 'Codex evaluator model.', 'gpt-6-luna')
		.option(
			'--review-limit <count>',
			'Maximum sites per class for semantic review.',
			parseReviewLimit,
			48
		);
}

function parseReviewLimit(value: string) {
	const count = Number(value);
	if (!/^\d+$/.test(value) || count < 1 || count > 512)
		throw new InvalidArgumentError('Use a whole number from 1 through 512.');
	return count;
}

async function runSiblingCommand(loop: string | undefined, flags: SiblingFlags) {
	validateRepairMode(loop, flags);
	const root = await projectRoot(flags);
	const state = await sweepLoop(root, loop, flags.reportOnly);
	const report = await siblingBugSweep({
		root,
		revision: flags.commit,
		model: flags.model,
		reviewLimit: flags.reviewLimit,
		report: flags.report,
		classId: flags.class,
		origin: parseOrigin(flags.origin)
	});
	const output = state ? await finishLoopSweep(root, state, report, flags) : report;
	console.log(JSON.stringify(output, null, 2));
	if (!siblingReportComplete(output)) process.exitCode = 1;
}

function validateRepairMode(loop: string | undefined, flags: SiblingFlags) {
	if (flags.repair && (!loop || flags.reportOnly || !flags.testCommand?.trim()))
		throw new Error(
			'Repair requires a loop and an explicit --test-command, without --report-only.'
		);
}

async function sweepLoop(root: string, loop: string | undefined, reportOnly?: boolean) {
	if (!loop || reportOnly) return undefined;
	const { state } = await readLoopStatus({ root, loop: validateLoopId(loop, 'Loop name') });
	assertLoopOpen(state);
	return state;
}

async function finishLoopSweep(
	root: string,
	state: LoopState,
	report: BugSweepReport,
	flags: SiblingFlags
) {
	const runId = randomUUID();
	const pending = { ...report, ...(flags.repair ? { repairs: [] } : {}) };
	const recorded = await beginSiblingReport(root, state.name, runId, pending);
	const repairs = flags.repair
		? await repairSiblings(
				report,
				{
					root,
					runId,
					testCommand: flags.testCommand!,
					workerModel: flags.workerModel ?? flags.model
				},
				undefined,
				recorded.persist
			)
		: undefined;
	const output = { ...report, repairs, evidence: recorded.filename };
	const next = state.steps.find((step) => step.status === 'pending');
	if (
		next?.id === 'siblings' &&
		siblingReportComplete(output) &&
		report.revision === (await new GitAdapter(root).run(['rev-parse', 'HEAD']))
	)
		await completeLoopStep({ root, loop: state.name, step: 'siblings', evidence: output.evidence });
	return output;
}

async function runReviewCommand(base: string, flags: ReviewFlags) {
	const result = await reviewKnownClasses({
		root: await projectRoot(flags),
		base,
		revision: flags.commit,
		model: flags.model,
		reviewLimit: flags.reviewLimit
	});
	console.log(JSON.stringify(result, null, 2));
	if (!result.passed) process.exitCode = 1;
}

function projectRoot(flags: ReviewFlags) {
	return new GitAdapter(resolve(flags.project ?? process.cwd())).run([
		'rev-parse',
		'--show-toplevel'
	]);
}

function parseOrigin(value?: string) {
	if (value === undefined) return undefined;
	const result = /^(.+):([1-9]\d*)$/.exec(value);
	if (!result || !Number.isSafeInteger(Number(result[2])))
		throw new Error('Use a repository path and positive line number for --origin.');
	return { path: result[1], line: Number(result[2]) };
}
