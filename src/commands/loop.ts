import type { Command } from 'commander';
import {
	addLoopStep,
	completeLoopStep,
	createLoop,
	readLoopStatus,
	renderLoopStatus
} from '../workflows/manageLoop';

export function registerLoopCommand(program: Command): void {
	const command = program
		.command('loop')
		.description('Define and trace verifiable agent work loops.');

	command
		.command('create <name>')
		.requiredOption('--goal <goal>', 'Human-facing goal for the loop.')
		.description('Create a new verifiable work loop.')
		.action((name: string, options: { goal: string }) => runCreateLoop(name, options));

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
}

async function runCreateLoop(name: string, options: { goal: string }): Promise<void> {
	const status = await createLoop({ name, goal: options.goal });
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
