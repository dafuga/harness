import { analyticsOptions } from '../utils/analyticsOptions';
import type { Command } from 'commander';
import type { ResponseCheckOptions } from '../core/responseCheckTypes';
import { runResponseCheck } from '../workflows/runResponseCheck';

export function registerResponseCheckCommand(program: Command): void {
	analyticsOptions(program.command('response-check'))
		.option('--request <file>', 'UTF-8 file containing the user request.')
		.option('--response <file>', 'UTF-8 file containing the LLM answer.')
		.option('--context <file>', 'Optional prior conversation or reference material.')
		.option('--criteria <file>', 'Optional JSON array of acceptance criteria.')
		.option('--model <model>', 'JEV model.', 'jev-1.13.0')
		.option('--min-confidence <number>', 'Minimum confidence for a decisive judgment.', '0.85')
		.option('--api-key-env <name>', 'Project-owned credential variable.', 'HARNESS_JEV_API_KEY')
		.option('--gate', 'Require confident success for every check.')
		.option('--json', 'Print structured judgments without raw input.')
		.option('--dry-run', 'Validate inputs and preview coverage without API calls.')
		.description('Check whether an LLM answer follows a user request using JEV.')
		.action((options: ResponseCheckOptions) => runResponseCheck(options));
}
