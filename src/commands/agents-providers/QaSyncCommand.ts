// @harness-uid u_apbouftqys
import { InvalidArgumentError, type Command } from 'commander';
import type { QaSyncCommandOptions } from './QaSyncCommand.types';

/** `harness qa-sync`: sync a project's Slack QA threads to GitHub labels and tracker notes. */
export class QaSyncCommand {
	register(program: Command): void {
		program
			.command('qa-sync')
			.description('Sync Slack QA threads to issues.')
			.requiredOption('--config <file>', 'Project QA sync JSON config; it holds no credentials.')
			.option('--state <file>', 'State file (default ~/.harness/qa-sync/<project>.json).')
			.option('--dry-run', 'Report what would change without writing anything.')
			.option('--backfill-comments', 'On the first run, also handle replies already posted.')
			.option('--watch', 'Keep polling until interrupted.')
			.option('--interval <seconds>', 'Seconds between watch passes (min 60).', seconds, 300)
			.option('--json', 'Print each report as JSON.')
			.option('--slack-token-file <file>', 'Or set HARNESS_QA_SLACK_TOKEN.')
			.option('--github-token-file <file>', 'Or set HARNESS_QA_GITHUB_TOKEN.')
			.option('--tracker <command>', 'Tracker CLI to run.', 'tracker')
			.action(async (options: QaSyncCommandOptions) => {
				const { runQaSync } = await import('../../workflows/agents-providers/runQaSync');
				process.exitCode = await runQaSync(options);
			});
	}
}

function seconds(value: string): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 60 || parsed > 86_400)
		throw new InvalidArgumentError('Use a whole number of seconds from 60 to 86400.');
	return parsed;
}
