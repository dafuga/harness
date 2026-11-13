// @harness-uid u_4iw26ey5fg
import { Command, Help } from 'commander';
import { sdkPackage } from '../utils/development-tooling/buildStamp';
import { commandHelp } from './commandHelp';
import { commandLoaders } from './commandLoaders';

/** Load only the selected family while preserving cheap, complete root help. */
export async function loadCliProgram(args: readonly string[]): Promise<Command> {
	const program = new Command()
		.name('harness')
		.description('Opinionated Rails-inspired coding harnesses for humans and agents.')
		.version(sdkPackage.version);
	const token = args[0] === 'help' ? args[1] : args[0];
	const selected = commandHelp.find((row) => row.name === token || row.aliases.includes(token));
	const family = selected?.name === 'plugin' ? 'module' : selected?.name;
	const defaultHelp = new Help();
	program.configureHelp({
		subcommandTerm: (command) =>
			command.parent === program
				? (commandHelp.find((row) => row.name === command.name())?.term ??
					defaultHelp.subcommandTerm(command))
				: defaultHelp.subcommandTerm(command)
	});
	for (const row of commandHelp) {
		if (row.name === family || (row.name === 'plugin' && family === 'module')) {
			if (row.name !== 'plugin')
				await commandLoaders[row.name as keyof typeof commandLoaders](program);
		} else {
			program.command(row.signature).description(row.description).aliases(row.aliases);
		}
	}
	return program;
}
