import type { Command } from 'commander';
import {
	recordRegression,
	type RecordRegressionInput
} from '../../workflows/verification-evidence/record-regression/recordRegression';
import { evaluateLoop, renderLoopEvaluation } from './loopEvaluate';
import { nextLoopStep, renderNextLoopStep } from './loopNext';
import { renderLoopSearchResults, searchLoops } from './loopSearch';
import {
	addLoopStep,
	completeLoopStep,
	createLoop,
	readLoopStatus,
	renderLoopStatus
} from './manageLoop';

export function registerLoopCommand(program: Command): void {
	const command = program
		.command('loop')
		.description('Define and trace verifiable agent work loops.');
	registerRegressionCommand(command);
	registerCreateCommand(command);

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
	options: {
		from?: string;
		goal: string;
		agentModel?: string;
		kind?: 'coding' | 'planning';
		plan?: string;
	}
): Promise<void> {
	const status = await createLoop({
		name,
		goal: options.goal,
		from: options.from,
		agentModel: options.agentModel,
		kind: options.kind,
		plan: options.plan
	});
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

function registerRegressionCommand(command: Command): void {
	command
		.command('record <loop>')
		.requiredOption(
			'--phase <phase>',
			'red for a failing test; green for its fix; capture for independent evidence.'
		)
		.option('--commit <revision>', 'Committed source to test in a clean snapshot.', 'HEAD')
		.option('--test <path...>', 'Tracked tests; red or capture phase only.')
		.option('--unit <id...>', 'Units covered by the run; red or capture phase only.')
		.option('--command <command>', 'Exact test command; inherited unchanged by green.')
		.option('--assertion <text>', 'Actual failed assertion that red output must contain.')
		.option('--timeout <ms>', 'Hard limit for this regression command.', '600000')
		.option('--json', 'Print the immutable checkpoint.')
		.description('Preserve a committed regression or an independent evidence capture.')
		.action(
			async (loop: string, options: Omit<RecordRegressionInput, 'loop'> & { json?: boolean }) => {
				const record = await recordRegression({ ...options, loop });
				console.log(
					options.json
						? JSON.stringify(record, null, 2)
						: `${record.phase}: ${record.status} at ${record.source.commit}`
				);
				if (record.phase === 'capture' && record.status !== 'passed') process.exitCode = 1;
			}
		);
}

function registerCreateCommand(command: Command): void {
	command
		.command('create <name>')
		.option('--agent-model <name>', 'Authoring model metadata.')
		.option('--kind <kind>', 'Task completion contract: coding or planning.')
		.option('--plan <path>', 'Committed proposal to audit at completion.')
		.option('--from <template>', 'Loop template to inherit from.')
		.requiredOption('--goal <goal>', 'Human-facing goal for the loop.')
		.description('Create a new verifiable work loop.')
		.action(
			(
				name: string,
				options: {
					from?: string;
					goal: string;
					agentModel?: string;
					kind?: 'coding' | 'planning';
					plan?: string;
				}
			) => runCreateLoop(name, options)
		);
}
