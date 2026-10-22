import type { Command } from 'commander';
export function analyticsOptions(command: Command): Command {
	return command
		.option('--loop <name>', 'Associate the check with a loop.')
		.option('--step <id>', 'Associate the check with a loop step.')
		.option('--task <id>', 'Stable task identity across revisions.')
		.option('--agent-model <name>', 'Model that authored the answer or code.')
		.option('--report <id>', 'Associated report run.');
}
