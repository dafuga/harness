/**
 * registerHistoryCommand is called on a bare Commander program named harness. Registration stores
 * nothing and no subcommand action runs here, so no temporary directory is needed: the examples
 * read back the commands, arguments, options and defaults that commander holds after registration.
 */
export type Described = {
	name: string;
	description: string;
	arguments: Array<{ name: string; required: boolean }>;
	options: Array<{ flags: string; default?: unknown }>;
	commands: Described[];
};

export type OptionDefault = { command: string; flags: string; default: unknown };
