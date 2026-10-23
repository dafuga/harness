import type { Command } from 'commander';
import { CpuUsageService } from '../../services/development-tooling/cpu-usage-service/CpuUsageService';
import { AnalyticsService } from './AnalyticsService';
export function registerAnalyticsCommand(program: Command): void {
	const analytics = program
		.command('analytics')
		.description('Query durable local cross-project Harness history.');
	analytics
		.command('cpu')
		.description('Sample live local CPU usage for the machine, Codex, Harness and agents.')
		.option('--json', 'Print structured results.')
		.action(async () => {
			const snapshot = await new CpuUsageService().snapshot();
			await new Promise<void>((done) => {
				process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n', () => done());
			});
		});
	for (const operation of [
		'summary',
		'loops',
		'jev',
		'models',
		'benchmarks',
		'events',
		'import',
		'export'
	]) {
		analytics
			.command(operation)
			.option('--json', 'Print structured results.')
			.option('--project <path>', 'Filter by project path.')
			.option(
				'--site <path>',
				'Only what was recorded in checkouts of the repository at this path.'
			)
			.option('--loop <name>', 'Filter by loop.')
			.option('--task <id>', 'Filter by task identity.')
			.option('--model <name>', 'Filter by author or evaluator model.')
			.option('--since <date>', 'Inclusive start date.')
			.option('--until <date>', 'Inclusive end date.')
			.option('--root <path>', 'Directory to import loop histories from.')
			.option('--output <file>', 'Standalone analytics snapshot output.')
			.action((options) => new AnalyticsService().execute(operation, options));
	}
}
