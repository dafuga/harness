import type { ProviderId, RunMode } from '../models/Desktop.types';

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

/** What a Plan may ask for: 1 to 10 design options, 3 unless the person chooses another. */
export const designCounts = Array.from({ length: 10 }, (_, index) => index + 1);

export const defaultDesignCount = 3;

/** Pages, shells and components are planned as images; every other kind as notes and cases. */
export function visualCategory(category: string): boolean {
	return ['pages', 'shells', 'components'].includes(category);
}

export { composeModes } from '../components/thread-panel/composeModes';
