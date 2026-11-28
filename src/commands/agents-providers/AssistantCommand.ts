// @harness-uid u_t45iixl4nf
import type { Command } from 'commander';
import type { AssistantCommandOptions } from './AssistantCommand.types';

/** Entry points for a configured project assistant. */
export class AssistantCommand {
	register(program: Command): void {
		const assistant = program.command('assistant').description('Run a Slack project assistant.');
		assistant
			.command('check')
			.description('Validate the project config locally.')
			.requiredOption('--config <file>', 'Credential-free project JSON.')
			.action(async ({ config }: AssistantCommandOptions) => {
				const { readAssistantConfig } =
					await import('../../workflows/agents-providers/run-assistant/readAssistantConfig');
				const { assistant: project } = await readAssistantConfig(config);
				console.log('Valid project assistant config for ' + project.displayName);
			});
		assistant
			.command('run')
			.description('Connect to Slack and answer questions until stopped.')
			.requiredOption('--config <file>', 'Credential-free project JSON.')
			.requiredOption('--credentials <directory>', 'Project credential files with mode 0600.')
			.option('--qa-since <timestamp>', 'UTC cutover timestamp for newly labeled QA issues.')
			.option('--qa-recipe <module>', 'Absolute path to a reviewed staging recording module.')
			.option('--tracker <executable>', 'Tracker executable.', 'tracker')
			.action(async (options: AssistantCommandOptions) => {
				const { runAssistant } = await import('../../workflows/agents-providers/runAssistant');
				await runAssistant(options);
			});
	}
}
