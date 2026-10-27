export type Scope = {
	files: string[];
	snapshot: string;
	scratch: string;
	readPaths: string[];
	protectedPaths: string[];
};

export type RunInput = {
	provider: 'codex' | 'claude';
	model: string;
	intelligence: string;
	cwd: string;
	prompt: string;
	signal: AbortSignal;
	scope?: Scope;
};

export type Usage = {
	inputTokens: number | null;
	outputTokens: number | null;
	cacheReadTokens: number | null;
	cacheWriteTokens: number | null;
	cacheWriteLongTokens: number | null;
	reportedCostUsd: number | null;
	reasoningTokens: number | null;
};

export type ClientResult = {
	text: string;
	reportedModel?: string | null;
	usage?: Partial<Usage>;
};

export type Tools = {
	readContract(unitId: string): Promise<unknown>;
	listContracts(kind?: string): Promise<unknown>;
	readAssigned(path: string): Promise<unknown>;
	writeAssigned(change: { path: string; expectedSha256: string; text: string }): Promise<unknown>;
};

export type ClientRequest = {
	provider: 'codex';
	model: string;
	intelligence: string;
	cwd: string;
	prompt: string;
	signal: AbortSignal;
	tools: Tools;
};

export type Session = { tools: Partial<Tools>; close(): Promise<void> };
export type Client = { ready(): Promise<void>; run(request: ClientRequest): Promise<ClientResult> };
export type Config = { client: Client; openBroker(input: RunInput): Promise<Session> };
export type Result = {
	provider: 'codex';
	model: string;
	intelligence: string;
	text: string;
	reportedModel: string | null;
	usage?: Usage;
};

export type Transport = { ready(): Promise<void>; run(input: RunInput): Promise<Result> };
export type RigOptions = {
	clientReady?: () => Promise<void>;
	clientRun?: (request: ClientRequest) => Promise<ClientResult>;
	openBroker?: (input: RunInput) => Promise<Session>;
	close?: () => Promise<void>;
	tools?: Partial<Tools>;
};
