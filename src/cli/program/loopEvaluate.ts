// @harness-uid u_rw46z3zz35
import type {
	LoopEvaluationResult,
	LoopCommandResult,
	EvaluateLoopInput
} from './loopEvaluate.types';
export type {
	LoopEvaluationResult,
	LoopCommandResult,
	EvaluateLoopInput
} from './loopEvaluate.types';
import { BoundedCommandAdapter } from '../../adapters/execution-runtimes/BoundedCommandAdapter';
import { commandDeadlines } from '../../adapters/execution-runtimes/bounded-command-adapter/commandDeadlines';
import { resourceEnvironment } from '../../utils/execution-runtimes/resourceEnvironment';
import { resourceWork } from '../../utils/execution-runtimes/resourceWork';
import {
	appendTrace,
	assertLoopOpen,
	loopPaths,
	loopRoot,
	readLoop,
	type LoopEvaluator
} from '../../workflows/development-tooling/loop-state/loopState';

export async function evaluateLoop(input: EvaluateLoopInput): Promise<LoopEvaluationResult> {
	const startedAt = Date.now();
	const root = loopRoot(input);
	const paths = loopPaths(root, input.loop);
	const state = await readLoop(paths.state);
	assertLoopOpen(state);
	const skipped = input.runEvaluators === false;
	const results = await runEvaluators(root, skipped ? [] : (state.evaluators ?? []), {
		loop: state.name,
		agentModel: state.agentModel
	});
	const passed = !skipped && results.every((result) => result.exitCode === 0);

	await appendTrace(paths.trace, {
		event: 'loop.evaluated',
		durationMs: Date.now() - startedAt,
		timestamp: input.now ? input.now() : new Date().toISOString(),
		loop: state.name,
		passed,
		results: results.map(summaryResult)
	});

	return {
		loop: state.name,
		tracePath: paths.traceRelative,
		passed,
		results,
		...(skipped ? { skipped: true } : {})
	};
}

export function renderLoopEvaluation(result: LoopEvaluationResult): string {
	if (result.skipped)
		return `Loop: ${result.loop}\nEvaluators: skipped (repository commands disabled)`;
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
	return resourceWork({ priority: 'agent-test', label: context.loop }, async (lease) => {
		const summary = { id: evaluator.id, title: evaluator.title, command: evaluator.command };
		try {
			const result = await new BoundedCommandAdapter().run('sh', ['-c', evaluator.command], {
				cwd: root,
				timeoutMs: evaluator.timeoutMs ?? commandDeadlines.evaluatorMs,
				env: {
					...resourceEnvironment(lease.env),
					HARNESS_ANALYTICS_LOOP: context.loop,
					HARNESS_ANALYTICS_STEP: evaluator.step,
					HARNESS_ANALYTICS_DISABLED: process.env.HARNESS_ANALYTICS_DISABLED,
					HARNESS_AGENT_MODEL: context.agentModel ?? process.env.HARNESS_AGENT_MODEL
				},
				onSpawn: (child) => {
					if (child.pid) lease.track(child.pid);
				}
			});
			return {
				...summary,
				exitCode: result.code,
				stdout: result.stdout.toString('utf8'),
				stderr: result.stderr,
				durationMs: Date.now() - startedAt
			};
		} catch (error) {
			return {
				...summary,
				exitCode: 1,
				stdout: '',
				stderr: error instanceof Error ? error.message : 'Evaluator could not start',
				durationMs: Date.now() - startedAt
			};
		}
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
