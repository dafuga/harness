// @harness-uid u_eymqu7nm4p
import type { AgentTurn } from '../../../models/agents-providers/AgentRunner.types';
export interface TurnItem {
	type: string;
	text?: string;
	result?: string;
	status?: string;
	savedPath?: string;
	revisedPrompt?: string | null;
	failure?: unknown;
	changes?: { path: string }[];
}
export interface TurnResult {
	text: string;
	model: string;
	images: TurnItem[];
}
export interface TurnOptions extends AgentTurn {
	reference?: string | null;
	image?: boolean;
}
/** A Codex turn that ran on another model or provider, failed on the server, did not complete, or timed out. */
export class CodexTurnError extends Error {
	override name = 'CodexTurnError';
}
