import { spawn } from 'node:child_process';
import {
	loopPaths,
	loopRoot,
	readLoop,
	appendTrace,
	type LoopEvaluator,
	type LoopInput
} from './loopState';

export interface LoopEvaluationResult {
	loop: string;
	tracePath: string;
	passed: boolean;
	results: LoopCommandResult[];
}

export interface LoopCommandResult {
	id: string;
	title: string;
	command: string;
	exitCode: number;
	stdout: string;
	durationMs?: number;
	stderr: string;
}

export interface EvaluateLoopInput extends LoopInput {
	loop: string;
}

export async function evaluateLoop(input: EvaluateLoopInput): Promise<LoopEvaluationResult> {
	const startedAt = Date.now();
	const root = loopRoot(input);
	const paths = loopPaths(root, input.loop);
	const state = await readLoop(paths.state);
	const results = await runEvaluators(root, state.evaluators ?? [], {
		loop: state.name,
		agentModel: state.agentModel
	});
	const passed = results.every((result) => result.exitCode === 0);

	await appendTrace(paths.trace, {
		event: 'loop.evaluated',
		durationMs: Date.now() - startedAt,
		timestamp: input.now ? input.now() : new Date().toISOString(),
		loop: state.name,
		passed,
		results: results.map(summaryResult)
	});

	return { loop: state.name, tracePath: paths.traceRelative, passed, results };
}

export function renderLoopEvaluation(result: LoopEvaluationResult): string {
	if (result.results.length === 0) return `Loop: ${result.loop}\nEvaluators: none`;
	return [
		`Loop: ${result.loop}`,
		`Result: ${result.passed ? 'passed' : 'failed'}`,
		'',
		...result.results.map(renderCommandResult)
	].join('\n');
}

function runEvaluators(
	root: string,
	evaluators: LoopEvaluator[],
	context: { loop: string; agentModel?: string }
): Promise<LoopCommandResult[]> {
	return Promise.all(evaluators.map((evaluator) => runEvaluator(root, evaluator, context)));
}

function runEvaluator(
	root: string,
	evaluator: LoopEvaluator,
	context: { loop: string; agentModel?: string }
): Promise<LoopCommandResult> {
	const startedAt = Date.now();
	return new Promise((resolve) => {
		const child = spawn(evaluator.command, {
			cwd: root,
			shell: true,
			stdio: 'pipe',
			env: {
				...process.env,
				HARNESS_ANALYTICS_LOOP: context.loop,
				HARNESS_ANALYTICS_STEP: evaluator.step,
				HARNESS_AGENT_MODEL: context.agentModel ?? process.env.HARNESS_AGENT_MODEL
			}
		});
		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];

		child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
		child.once('exit', (code) => {
			resolve({
				id: evaluator.id,
				title: evaluator.title,
				command: evaluator.command,
				exitCode: code ?? 1,
				durationMs: Date.now() - startedAt,
				stdout: Buffer.concat(stdout).toString('utf8'),
				stderr: Buffer.concat(stderr).toString('utf8')
			});
		});
	});
}

function renderCommandResult(result: LoopCommandResult): string {
	return [
		`[${result.exitCode === 0 ? 'passed' : 'failed'}] ${result.id} - ${result.title}`,
		`  command: ${result.command}`,
		`  exit code: ${result.exitCode}`
	].join('\n');
}

function summaryResult(result: LoopCommandResult): Record<string, unknown> {
	return {
		id: result.id,
		command: result.command,
		exitCode: result.exitCode,
		durationMs: result.durationMs
	};
}
