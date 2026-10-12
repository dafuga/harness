import type { ProviderId, RunMode } from '../models/Desktop.types';
import type { ProjectCapabilities } from '../models/ProjectContext.types';

/** A comment is written for people. It is no run mode and never reaches an agent. */
export type ComposeMode = 'comment' | RunMode;
export interface AgentChoice {
	provider: ProviderId;
	/** An identifier the provider itself listed. */
	model: string;
	effort: string | null;
}
export interface RunDraft extends AgentChoice {
	text: string;
	mode: RunMode;
}

/** Comment leads wherever people may comment; Plan and Change need agents at a writable tip. */
export function composeModes(capabilities: ProjectCapabilities, writable: boolean): ComposeMode[] {
	const modes: ComposeMode[] = capabilities.comments ? ['comment'] : [];
	return capabilities.agents && writable ? [...modes, 'plan', 'change'] : modes;
}
