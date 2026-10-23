import type { Command } from 'commander';
import { BenchmarkService } from './benchmark-service/BenchmarkService';

export function registerBenchmarkCommand(program: Command): void {
	const command = program
		.command('benchmark')
		.description('Compare subagents against fixed component contracts.');
	for (const operation of ['validate', 'run', 'results']) {
		command
			.command(`${operation} <target>`)
			.description(
				operation === 'results'
					? 'Read a persisted run ID.'
					: 'Use a benchmark definition JSON file.'
			)
			.option('--json', 'Print the run and structured comparisons.')
			.option('--seed <seed>', 'Reproducible candidate ordering.')
			.action((target, options) => new BenchmarkService().execute(operation, target, options));
	}
}
