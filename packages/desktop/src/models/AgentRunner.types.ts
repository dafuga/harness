import type { ProviderState } from './Desktop.types';

/** How a local CLI is started. Tests inject a deterministic fake here; the app never does. */
export interface CliCommand {
	command: string;
	args: string[];
}

/** One request to a coding CLI. Only public text and status words come back. */
export interface AgentTurn {
	model: string;
	effort: string | null;
	cwd: string;
	prompt: string;
	reference?: string | null;
	/** `read-only` may inspect the project; `write` may change files under `cwd`. */
	access: 'read-only' | 'write';
	signal: AbortSignal;
	onText(text: string): void;
	onStatus(status: string): void;
	onFile?(path: string): void;
}

export interface AgentResult {
	text: string;
	/** The model the CLI reported it ran, as it reported it. */
	model: string;
}

export interface AgentRunner {
	discover(): Promise<ProviderState>;
	run(turn: AgentTurn): Promise<AgentResult>;
}

export interface ImageRequest {
	prompt: string;
	/** The original image a revision refers to, as a local file; null for a first design. */
	reference: string | null;
	/** A task-owned temporary directory: the only place the generation may write. */
	cwd: string;
	model: string;
	signal: AbortSignal;
	onStatus(status: string): void;
	onFile?(path: string): void;
}

export interface GeneratedImage {
	bytes: Uint8Array;
	revisedPrompt: string | null;
}

export interface ImageGenerator {
	generateImage(request: ImageRequest): Promise<GeneratedImage>;
}

/** A run that was cancelled by its owner, as distinct from one that failed. */
export class RunCancelled extends Error {
	constructor() {
		super('The run was cancelled.');
		this.name = 'RunCancelled';
	}
}
