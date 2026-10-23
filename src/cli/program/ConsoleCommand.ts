import type { Flags } from './ConsoleCommand.types';
import type { Command } from 'commander';
import {
	consoleObjects,
	installConsole,
	renderConsoleUninstall,
	renderConsoleChange,
	renderConsoleInstall,
	restoreConsoleFile,
	uninstallConsole
} from './installConsole';

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
			'--bucket <binding>',
			'Read the history from this private object store binding instead of bundling it.'
		)
		.option('--prefix <path>', 'Path inside the bucket the index was uploaded under.')
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
	registerUpkeep(console_);
	return console_;
}

/** What follows an install: the objects a bucket needs, and putting back a replaced file. */
function registerUpkeep(console_: Command): void {
	console_
		.command('objects')
		.requiredOption('--data <directory>', 'History index: the output of harness history build.')
		.option('--prefix <path>', 'Path inside the bucket to upload the index under.')
		.option('--json', 'Print the list as key and file pairs, as an upload tool takes it.')
		.description('List what a private bucket must hold for a console installed with --bucket.')
		.action(async (flags: { data: string; prefix?: string; json?: boolean }) => {
			const objects = await consoleObjects(flags.data, flags.prefix);
			const lines = objects.map((entry) => `${entry.key}\t${entry.file}`);
			console.log(flags.json ? JSON.stringify(objects, null, 2) : lines.join('\n'));
		});
	console_
		.command('uninstall')
		.requiredOption('--host <directory>', 'SvelteKit project the console was installed into.')
		.option('--update', 'Remove generated files the host edited too; they are saved and recorded.')
		.option('--keep', "Leave generated files the host edited in place, as the host's own.")
		.option('--json', 'Print structured results.')
		.description('Remove the console and put back what its install replaced.')
		.action(async (flags: Pick<Flags, 'host' | 'update' | 'keep' | 'json'>) => {
			const result = await uninstallConsole(flags);
			console.log(flags.json ? JSON.stringify(result, null, 2) : renderConsoleUninstall(result));
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
}
