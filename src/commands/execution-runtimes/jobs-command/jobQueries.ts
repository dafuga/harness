// @harness-uid u_indrqowxfq
import type { Command } from 'commander';
import { JobStatisticsService } from '../../../services/execution-runtimes/JobStatisticsService';
import { QueueEtaService } from '../../../services/execution-runtimes/QueueEtaService';
import { DriverQueueAdapter } from '../../../adapters/execution-runtimes/DriverQueueAdapter';
import { jobsQueue } from './jobsQueue';
import { printJobEta, printJobStats } from './jobsOutput';
import type { JobsOptions } from '../JobsCommand.types';
import { withJobHistory } from './withJobHistory';
export function registerJobQueries(jobs: Command): void {
	registerJobStats(jobs);
	registerJobActive(jobs);
	registerJobEta(jobs);
}
export function registerJobStats(jobs: Command): void {
	jobs
		.command('stats')
		.option('--home <path>')
		.option('--type <type>')
		.option('--model <model>')
		.option('--json')
		.action((options: JobsOptions) =>
			withJobHistory(options, (history) => {
				const records = history.all();
				const groups = new JobStatisticsService(records)
					.summary()
					.filter(
						(g) =>
							(!options.type || options.type === g.type) &&
							(!options.model || options.model === g.model)
					);
				if (options.json)
					console.log(
						JSON.stringify(
							{
								home: history.home,
								groups,
								completed: groups.reduce((sum, g) => sum + g.count, 0),
								cancelled: records.filter((r) => r.outcome === 'cancelled').length
							},
							null,
							2
						)
					);
				else printJobStats(groups);
			})
		);
}
export function registerJobActive(jobs: Command): void {
	jobs
		.command('active')
		.option('--status-dir <path>')
		.option('--driver-root <path>')
		.option('--json')
		.option('--markdown')
		.action((options: JobsOptions) => {
			const driver = new DriverQueueAdapter({
				root: options.driverRoot,
				statusDir: options.statusDir
			});
			console.log(options.json ? JSON.stringify(driver.active(), null, 2) : driver.render());
		});
}
export function registerJobEta(jobs: Command): void {
	jobs
		.command('eta')
		.option('--home <path>')
		.option('--status-dir <path>')
		.option('--driver-root <path>')
		.option('--what-if <count|all-modules>')
		.option('--type <type>')
		.option('--model <model>')
		.option('--slots <model=count,...>')
		.option('--queue <json-file>')
		.option('--project <path>')
		.option('--json')
		.action((options: JobsOptions) =>
			withJobHistory(options, (history) => {
				const driver = new DriverQueueAdapter({
					root: options.driverRoot,
					statusDir: options.statusDir
				});
				const queue = jobsQueue(
					options,
					options.queue ? { queued: [], running: [], slots: {} } : driver.read()
				);
				const result = new QueueEtaService(new JobStatisticsService(history.all())).estimate(queue);
				if (options.json) console.log(JSON.stringify(result, null, 2));
				else printJobEta(result);
			})
		);
}
