// @harness-uid u_dvprh5x3mq
import type { Command } from 'commander';
import { withJobHistory } from './jobs-command/withJobHistory';
import { JobBackfillService } from '../../services/execution-runtimes/JobBackfillService';
import { DriverQueueAdapter } from '../../adapters/execution-runtimes/DriverQueueAdapter';
import { jobsRecord } from './jobs-command/jobsRecord';
import { registerJobQueries } from './jobs-command/jobQueries';
import type { JobsOptions } from './JobsCommand.types';
/** Records duration history and reports read-only queue estimates from any folder. */
export class JobsCommand {
	register(program: Command): void {
		const jobs = program
			.command('jobs')
			.description('Record job durations and estimate queued work.');
		registerJobQueries(jobs);
		this.records(jobs);
		jobs
			.command('backfill')
			.argument('[root]')
			.option('--home <path>')
			.option('--driver-root <path>')
			.option('--json')
			.action((root: string | undefined, options: JobsOptions) =>
				withJobHistory(options, (history) => {
					const result = new JobBackfillService(history).import(
						root ?? new DriverQueueAdapter({ root: options.driverRoot }).root
					);
					console.log(JSON.stringify(result, null, 2));
				})
			);
	}
	private records(jobs: Command): void {
		const record = jobs.command('record').description('Idempotent runner lifecycle events.');
		for (const phase of ['start', 'end']) {
			const command = record
				.command(phase)
				.requiredOption('--id <id>')
				.requiredOption('--source <run-id>')
				.option('--attempt <n>', 'Attempt number', '1')
				.option('--at <ISO>')
				.option('--home <path>')
				.option('--json');
			if (phase === 'start')
				command
					.requiredOption('--unit <unit>')
					.requiredOption('--type <type>')
					.requiredOption('--model <model>');
			else command.requiredOption('--outcome <pass|fail|cancelled>');
			command.action((options: JobsOptions) =>
				withJobHistory(options, (history) =>
					console.log(JSON.stringify(jobsRecord(history, phase, options), null, 2))
				)
			);
		}
	}
}
