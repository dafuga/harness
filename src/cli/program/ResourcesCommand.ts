import type { Command } from 'commander';
import { resourceConfigSchema } from '../../core/execution-runtimes/resourceTypes';
import { ResourceQueueService } from '../../services/execution-runtimes/ResourceQueueService';
import { resourceCommand } from '../../utils/execution-runtimes/resourceCommand';
import { resourceConfig, saveResourceConfig } from '../../utils/execution-runtimes/resourceConfig';
import { resourceRequest } from '../../utils/execution-runtimes/resourceRequest';
export function registerResourcesCommand(program: Command): void {
	const resources = program
		.command('resources')
		.description('Shared CPU and memory admission for managed work.');
	resources
		.command('status')
		.option('--json')
		.action(async () => {
			const service = new ResourceQueueService();
			try {
				const result = {
					config: resourceConfig(service.home),
					snapshot: await service.snapshot(),
					jobs: service.queue.all()
				};
				console.log(JSON.stringify(result, null, 2));
			} finally {
				service.close();
			}
		});
	resources
		.command('configure')
		.option('--cpu-reserve-percent <n>')
		.option('--memory-reserve-percent <n>')
		.option('--min-memory-reserve-mib <n>')
		.action((flags: Record<string, string>) => {
			const current = resourceConfig();
			for (const key of [
				'cpuReservePercent',
				'memoryReservePercent',
				'minMemoryReserveMiB'
			] as const)
				if (flags[key === 'minMemoryReserveMiB' ? 'minMemoryReserveMib' : key] !== undefined)
					current[key] = Number(flags[key === 'minMemoryReserveMiB' ? 'minMemoryReserveMib' : key]);
			saveResourceConfig(resourceConfigSchema.parse(current));
			console.log(JSON.stringify(current, null, 2));
		});
	registerResourceRun(resources);
}

function registerResourceRun(resources: Command): void {
	resources
		.command('run')
		.description('Queue a command; preserve CPU and memory reserves.')
		.argument('<command...>')
		.option('--label <label>', 'Public queue label; omit private command contents', 'Managed work')
		.option('--priority <kind>', 'agent-test, coding or environment', 'coding')
		.option('--cpus <n>', 'Estimated CPU cores', '1')
		.option('--memory-mib <n>', 'Estimated peak additional RAM', '512')
		.option('--timeout <ms>', 'Maximum execution time after admission', '21600000')
		.option('--wait-timeout <ms>', 'Maximum time queued', '1800000')
		.action(async (command: string[], flags: Record<string, string>) => {
			const service = new ResourceQueueService(),
				abort = new AbortController();
			const cancel = () => abort.abort(new Error('Managed work cancelled'));
			process.once('SIGINT', cancel);
			process.once('SIGTERM', cancel);
			try {
				const request = await resourceRequest(flags, service);
				process.exitCode = await service.run(
					request,
					(context) => resourceCommand(command, context, abort.signal, Number(flags.timeout)),
					{
						signal: abort.signal,
						waitTimeoutMs: Number(flags.waitTimeout),
						onWaiting: (reason) => console.error(`[harness resources] ${reason}`)
					}
				);
			} finally {
				process.removeListener('SIGINT', cancel);
				process.removeListener('SIGTERM', cancel);
				service.close();
			}
		});
}
