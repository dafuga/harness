import type { BenchmarkTrialInput } from './benchmarkTrial.types';
export type { BenchmarkTrialInput } from './benchmarkTrial.types';
import type { BenchmarkTrial } from '../../../core/agents-providers/subagentBenchmarkTypes';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { createBenchmarkWorkspace } from './benchmarkWorkspace';
import { evaluateBenchmarkSubmission, setupBenchmarkWorkspace } from './benchmarkEvaluate';
export async function runBenchmarkTrial(input: BenchmarkTrialInput): Promise<void> {
	const started = Date.now();
	const deadline = AbortSignal.timeout(input.run.definition.budget.timeoutMs);
	const signal = AbortSignal.any([input.signal, deadline]);
	const workspace = join(input.directory, input.trial.id);
	const baseline = join(input.directory, 'baseline');
	try {
		await createBenchmarkWorkspace(baseline, workspace);
		await setupBenchmarkWorkspace(workspace, input.run.definition, signal);
		await submitBenchmarkTrial(input, { workspace, baseline, signal });
	} catch (error) {
		input.trial.status = failureStatus(input.signal, deadline);
		input.trial.error = error instanceof Error ? error.message : 'Benchmark trial failed.';
	} finally {
		input.trial.durationMs = Date.now() - started;
		await input.persist();
		await rm(workspace, { recursive: true, force: true });
		await rm(join(input.directory, 'evaluation'), { recursive: true, force: true });
	}
}
async function submitBenchmarkTrial(
	input: BenchmarkTrialInput,
	context: { workspace: string; baseline: string; signal: AbortSignal }
): Promise<void> {
	const trial = input.trial;
	let prompt = benchmarkPrompt(input);
	for (let attempt = 0; attempt <= input.run.definition.budget.repairs; attempt++) {
		trial.repairs = attempt;
		const started = Date.now();
		try {
			const turn = await input.runner.run({
				candidate: input.candidate,
				cwd: context.workspace,
				prompt,
				session: trial.turns.at(-1)?.session,
				signal: context.signal
			});
			trial.turns.push(turn);
		} finally {
			trial.agentDurationMs += Date.now() - started;
		}
		const evaluated = Date.now();
		let submission;
		try {
			submission = await evaluateBenchmarkSubmission({
				...context,
				definition: input.run.definition,
				workspace: context.workspace,
				evaluation: join(input.directory, 'evaluation'),
				files: input.files
			});
		} finally {
			trial.evaluationDurationMs += Date.now() - evaluated;
		}
		trial.submissions.push(submission);
		if (attempt === 0) trial.firstSubmissionPassed = submission.passed;
		trial.status = attempt < input.run.definition.budget.repairs ? 'running' : 'failed';
		if (submission.invalidFiles.length) trial.status = 'invalid';
		if (submission.passed) trial.status = 'passed';
		await input.persist();
		if (trial.status === 'passed' || trial.status === 'invalid') return;
		prompt = `Repair the implementation within the original contract. Acceptance feedback:\n${JSON.stringify(submission.checks)}`;
	}
}
function benchmarkPrompt(input: BenchmarkTrialInput): string {
	const definition = input.run.definition;
	return [
		input.candidate.instructions,
		definition.task,
		`Contract:\n${definition.contract}`,
		`Edit only these exact files: ${definition.allowedFiles.join(', ')}. All other files and tests are protected.`,
		`Acceptance checks:\n${JSON.stringify(definition.checks)}`,
		'Work only in this workspace. Do not commit, deploy, contact others, or start other agents. Submit by finishing your response.'
	].join('\n\n');
}
function failureStatus(signal: AbortSignal, deadline: AbortSignal): BenchmarkTrial['status'] {
	if (signal.aborted) return 'interrupted';
	if (deadline.aborted) return 'timeout';
	return 'error';
}
