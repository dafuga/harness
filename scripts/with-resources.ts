// @harness-uid u_d2pmwm5tae
import { fileURLToPath } from 'node:url';

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
		throw new Error('Usage: with-resources <coding|agent-test|environment> -- <command...>');
	return [
		'resources',
		'run',
		'--priority',
		env.HARNESS_RESOURCE_PRIORITY || priority,
		'--cpus',
		env.HARNESS_RESOURCE_CPUS || '1',
		'--memory-mib',
		env.HARNESS_RESOURCE_MEMORY_MIB || '2048',
		'--',
		...command
	];
}

if (import.meta.main) {
	const entry = fileURLToPath(new URL('../src/cli/index.ts', import.meta.url));
	process.argv = [
		process.execPath,
		entry,
		...resourceArguments(process.argv.slice(2), process.env)
	];
	const { runCli } = await import('../src/cli/runCli');
	await runCli(entry);
}
