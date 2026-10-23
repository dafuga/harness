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
