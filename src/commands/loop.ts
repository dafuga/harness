import type { Command } from 'commander';
import {
	addLoopStep,
	completeLoopStep,
	createLoop,
	readLoopStatus,
	renderLoopStatus
} from '../workflows/manageLoop';
import { evaluateLoop, renderLoopEvaluation } from '../workflows/loopEvaluate';
import { nextLoopStep, renderNextLoopStep } from '../workflows/loopNext';
import { renderLoopSearchResults, searchLoops } from '../workflows/loopSearch';

export function registerLoopCommand(program: Command): void {
	const command = program
		.command('loop')
		.description('Define and trace verifiable agent work loops.');

	command
		.command('create <name>')
		.option('--from <template>', 'Loop template to inherit from.')
		.requiredOption('--goal <goal>', 'Human-facing goal for the loop.')
		.description('Create a new verifiable work loop.')
		.action((name: string, options: { from?: string; goal: string }) =>
			runCreateLoop(name, options)
		);

	command
		.command('add <loop> <step>')
		.requiredOption('--title <title>', 'Verifiable step title.')
		.description('Add a step to a loop.')
		.action((loop: string, step: string, options: { title: string }) =>
			runAddStep(loop, step, options)
		);

	command
		.command('complete <loop> <step>')
		.requiredOption('--evidence <evidence>', 'Evidence proving the step is complete.')
		.description('Mark a loop step complete.')
		.action((loop: string, step: string, options: { evidence: string }) =>
			runCompleteStep(loop, step, options)
		);

	command
		.command('status <loop>')
		.option('--json', 'Print structured loop status.')
		.description('Show loop state and trace location.')
		.action((loop: string, options: { json?: boolean }) => runStatus(loop, options));

	command
		.command('search [query]')
		.option('--json', 'Print structured loop search results.')
		.description('Search loop templates and existing loop instances.')
		.action((query: string | undefined, options: { json?: boolean }) => runSearch(query, options));

	command
		.command('next <loop>')
		.option('--json', 'Print structured next-step guidance.')
		.description('Show the next pending loop step.')
		.action((loop: string, options: { json?: boolean }) => runNext(loop, options));

	command
		.command('evaluate <loop>')
		.option('--json', 'Print structured evaluator results.')
		.description('Run evaluator commands for a loop.')
		.action((loop: string, options: { json?: boolean }) => runEvaluate(loop, options));
}

async function runCreateLoop(
	name: string,
	options: { from?: string; goal: string }
): Promise<void> {
	const status = await createLoop({ name, goal: options.goal, from: options.from });
	console.log(renderLoopStatus(status));
}

async function runAddStep(loop: string, step: string, options: { title: string }): Promise<void> {
	const status = await addLoopStep({ loop, step, title: options.title });
	console.log(renderLoopStatus(status));
}

async function runCompleteStep(
	loop: string,
	step: string,
	options: { evidence: string }
): Promise<void> {
	const status = await completeLoopStep({ loop, step, evidence: options.evidence });
	console.log(renderLoopStatus(status));
}

async function runStatus(loop: string, options: { json?: boolean }): Promise<void> {
	const status = await readLoopStatus({ loop });
	console.log(options.json ? JSON.stringify(status, null, 2) : renderLoopStatus(status));
}

async function runSearch(query: string | undefined, options: { json?: boolean }): Promise<void> {
	const results = await searchLoops({ query });
	console.log(options.json ? JSON.stringify(results, null, 2) : renderLoopSearchResults(results));
}

async function runNext(loop: string, options: { json?: boolean }): Promise<void> {
	const result = await nextLoopStep({ loop });
	console.log(options.json ? JSON.stringify(result, null, 2) : renderNextLoopStep(result));
}

async function runEvaluate(loop: string, options: { json?: boolean }): Promise<void> {
	const result = await evaluateLoop({ loop });
	console.log(options.json ? JSON.stringify(result, null, 2) : renderLoopEvaluation(result));
	if (!result.passed) process.exitCode = 1;
}
