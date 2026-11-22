export type Registration = {
	name: string;
	description: string;
	arguments: Array<{ name: string; required: boolean }>;
	options: string[];
};

export type Invocation = {
	registration: Registration;
	printed: string[];
	error: { name: string; message: string } | null;
};
