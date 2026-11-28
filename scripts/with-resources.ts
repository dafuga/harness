// @harness-uid u_d2pmwm5tae
import { fileURLToPath } from 'node:url';
import { ExpectedCliError } from '../src/core/errors';
import { isHeavyTestCommand } from '../src/utils/execution-runtimes/withMacHeavyTestLane';

const fullCheckLabel = 'Full repository check';

function isFullCheck(command: string[]): boolean {
	return command[0] === 'bun' && command[1] === 'scripts/run-checks.ts';
}

/** Construct the existing resource CLI request without shell interpolation. */
export function resourceArguments(
	args: string[],
	env: Record<string, string | undefined>
): string[] {
	const [priority, separator, ...command] = args;
	if (
		!['coding', 'agent-test', 'environment'].includes(priority) ||
		separator !== '--' ||
		!command.length
	)
		throw new ExpectedCliError(
			'Usage: with-resources <coding|agent-test|environment> -- <command...>'
		);
	const fullCheck = isFullCheck(command);
	return [
		'resources',
		'run',
		...(fullCheck ? ['--label', fullCheckLabel] : []),
		...(isHeavyTestCommand(command) ? ['--heavy-test'] : []),
		'--priority',
		fullCheck && process.platform === 'darwin'
			? 'agent-test'
			: env.HARNESS_RESOURCE_PRIORITY || priority,
		'--cpus',
		env.HARNESS_RESOURCE_CPUS || '1',
		'--memory-mib',
		env.HARNESS_RESOURCE_MEMORY_MIB || '2048',
		'--',
		...command
	];
}

async function runResources(args: string[]): Promise<void> {
	const entry = fileURLToPath(new URL('../src/cli/index.ts', import.meta.url));
	process.argv = [process.execPath, entry, ...args];
	const { runCli } = await import('../src/cli/runCli');
	await runCli(entry);
}

if (import.meta.main) await runResources(resourceArguments(process.argv.slice(2), process.env));
