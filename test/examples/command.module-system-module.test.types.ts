export type CommandShape = {
	name: string;
	arguments: Array<{ name: string; required: boolean }>;
	options: string[];
	commands: CommandShape[];
};
