import type { Command } from 'commander';
import {
	installConsole,
	renderConsoleChange,
	renderConsoleInstall,
	restoreConsoleFile,
	type ConsoleInstallFlags
} from '../workflows/installConsole';

type Flags = ConsoleInstallFlags & { json?: boolean };

export function registerConsoleCommand(program: Command): Command {
	const console_ = program
		.command('console')
		.description(
			'Embed the Harness console in a SvelteKit application, behind its own admin policy.'
		);
	console_
		.command('install')
		.requiredOption('--host <directory>', 'SvelteKit project to install into.')
		.requiredOption(
			'--policy <module>',
			'Module of the host that exports its admin policy, for example $lib/server/harnessPolicy.'
		)
		.option('--policy-export <name>', 'Name the policy is exported under.', 'harnessPolicy')
		.option('--base <path>', 'Route the console is served under.', '/harness')
		.option('--data <directory>', 'History index to bundle: the output of harness history build.')
		.option(
			'--update',
			'Replace files that hold other content; what they held is saved and the change recorded.'
		)
		.option('--keep', "Leave files that hold other content as the host's own version.")
		.option('--json', 'Print structured results.')
		.description(
			'Write the protected routes and server module; nothing is served without the policy.'
		)
		.action(async (flags: Flags) => {
			const result = await installConsole(flags);
			console.log(flags.json ? JSON.stringify(result, null, 2) : renderConsoleInstall(result));
		});
	console_
		.command('restore <path>')
		.requiredOption('--host <directory>', 'SvelteKit project the console was installed into.')
		.option('--json', 'Print structured results.')
		.description('Put back the contents an install replaced; the restore is recorded as well.')
		.action(async (path: string, flags: { host: string; json?: boolean }) => {
			const change = await restoreConsoleFile(flags.host, path);
			console.log(flags.json ? JSON.stringify(change, null, 2) : renderConsoleChange(change));
		});
	return console_;
}
