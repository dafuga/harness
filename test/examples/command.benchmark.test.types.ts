export type CommandShape = {
	name: string;
	arguments: Array<{ name: string; required: boolean }>;
	options: Array<{ flags: string }>;
	commands: CommandShape[];
};
