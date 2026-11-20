// @harness-uid u_wgjqmurp64
import { Command, InvalidArgumentError, Option } from 'commander';
import {
	defaultContextTokens,
	contextThreshold
} from '../../adapters/agents-providers/module-task-runner-adapter/sessionPolicy';
import { runTaskOrchestration } from '../../workflows/agents-providers/task-orchestration/runTaskOrchestration';
import type { OrchestratorFlags } from './TaskOrchestrationCommand.types';

/** Run an orchestration brief in a supervised foreground provider session. */
export class TaskOrchestrationCommand {
	register(task: Command): void {
		task
			.command('orchestrate')
			.description('Launch and supervise an orchestration brief in this worktree.')
			.requiredOption('--tracker <id>', 'Tracker item for restart handoffs.')
			.requiredOption('--brief <file>', 'Path to a short, durable orchestration brief.')
			.requiredOption('--model <id>', 'Exact Claude or Codex model ID.')
			.addOption(
				new Option('--intelligence <level>')
					.choices(['low', 'medium', 'high', 'xhigh', 'max', 'ultra'])
					.default('medium')
			)
			.option(
				'--context-tokens <count>',
				'Rotate at or below 150000 active input tokens.',
				parseThreshold,
				defaultContextTokens
			)
			.action((flags: OrchestratorFlags) => this.run(flags));
	}

	async run(flags: OrchestratorFlags): Promise<void> {
		const controller = new AbortController();
		const stop = () => controller.abort(new Error('Orchestration interrupted.'));
		process.once('SIGINT', stop);
		process.once('SIGTERM', stop);
		try {
			const report = await runTaskOrchestration(process.cwd(), flags, controller.signal);
			console.log(JSON.stringify(report, null, 2));
			if (report.status !== 'succeeded') process.exitCode = 1;
		} finally {
			process.off('SIGINT', stop);
			process.off('SIGTERM', stop);
		}
	}
}

function parseThreshold(value: string): number {
	try {
		if (/^\d+$/.test(value)) return contextThreshold(Number(value));
	} catch {
		/* Report the option error through Commander. */
	}
	throw new InvalidArgumentError('Expected an integer from 1 to 150000.');
}
