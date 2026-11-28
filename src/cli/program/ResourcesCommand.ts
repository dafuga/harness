// @harness-uid u_abwt7sz4bl
import type { Command } from 'commander';
import { resourceConfigSchema } from '../../core/execution-runtimes/resourceTypes';
import { ResourceQueueService } from '../../services/execution-runtimes/ResourceQueueService';
import { resourceCommand } from '../../utils/execution-runtimes/resourceCommand';
import { resourceConfig, saveResourceConfig } from '../../utils/execution-runtimes/resourceConfig';
import { resourceRequest } from '../../utils/execution-runtimes/resourceRequest';
import {
	isHeavyTestCommand,
	withMacHeavyTestLane
} from '../../utils/execution-runtimes/withMacHeavyTestLane';
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
		.option('--heavy-test', 'Queue a heavy test command in the macOS test lanes')
		.action(async (command: string[], flags: Record<string, string> & { heavyTest?: boolean }) => {
			const service = new ResourceQueueService(),
				abort = new AbortController();
			const cancel = () => abort.abort(new Error('Managed work cancelled'));
			process.once('SIGINT', cancel);
			process.once('SIGTERM', cancel);
			try {
				process.exitCode = await runResourceCommand(command, flags, service, abort.signal);
			} finally {
				process.removeListener('SIGINT', cancel);
				process.removeListener('SIGTERM', cancel);
				service.close();
			}
		});
}

async function runResourceCommand(
	command: string[],
	{ heavyTest, ...flags }: Record<string, string> & { heavyTest?: boolean },
	service: ResourceQueueService,
	signal: AbortSignal
) {
	const heavy = heavyTest === true || isHeavyTestCommand(command);
	const waitTimeoutMs = Number(flags.waitTimeout);
	const request = await resourceRequest(
		heavy && process.platform === 'darwin' ? { ...flags, priority: 'agent-test' } : flags,
		service
	);
	return await withMacHeavyTestLane({ enabled: heavy, signal, waitTimeoutMs }, (env, beforeStart) =>
		service.run(
			request,
			async (context) => {
				await beforeStart();
				return await resourceCommand(command, context, signal, Number(flags.timeout));
			},
			{
				env,
				signal,
				waitTimeoutMs,
				onWaiting: (reason) => console.error(`[harness resources] ${reason}`)
			}
		)
	);
}
