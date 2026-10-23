import type { RunMode } from '../../models/development-tooling/Desktop.types';
import type { ProviderId } from '../../models/development-tooling/Desktop.types';

/** A comment is written for people. It is no run mode and never reaches an agent. */
export type ComposeMode = 'comment' | 'ask' | RunMode;

export interface AgentChoice {
	provider: ProviderId;
	/** An identifier the provider itself listed. */
	model: string;
	effort: string | null;
}

export interface RunDraft extends AgentChoice {
	text: string;
	mode: RunMode | 'ask';
	/** Plan of a visual unit only: how many separately generated design options, 1 to 10. */
	designOptions?: number;
}
