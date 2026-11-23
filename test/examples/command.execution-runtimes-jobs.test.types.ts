export type CommandShape = {
	name: string;
	description: string;
	arguments: Array<{ name: string; required: boolean }>;
	options: Array<{ flags: string; default: string | null }>;
	commands: CommandShape[];
};
