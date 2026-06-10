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
	stderr: string;
}

export interface EvaluateLoopInput extends LoopInput {
	loop: string;
}

export async function evaluateLoop(input: EvaluateLoopInput): Promise<LoopEvaluationResult> {
	const root = loopRoot(input);
	const paths = loopPaths(root, input.loop);
	const state = await readLoop(paths.state);
	const results = await runEvaluators(root, state.evaluators ?? []);
	const passed = results.every((result) => result.exitCode === 0);

	await appendTrace(paths.trace, {
		event: 'loop.evaluated',
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

function runEvaluators(root: string, evaluators: LoopEvaluator[]): Promise<LoopCommandResult[]> {
	return Promise.all(evaluators.map((evaluator) => runEvaluator(root, evaluator)));
}

function runEvaluator(root: string, evaluator: LoopEvaluator): Promise<LoopCommandResult> {
	return new Promise((resolve) => {
		const child = spawn(evaluator.command, { cwd: root, shell: true, stdio: 'pipe' });
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
		exitCode: result.exitCode
	};
}
