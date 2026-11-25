export type AgentInput = {
	cwd: string;
	access: string;
	signal: AbortSignal;
	onFile: (p: string) => void;
};

export type Agent = (input: AgentInput) => Promise<{ text: string }>;

export type Outcome = { output: unknown } | { error: string };
