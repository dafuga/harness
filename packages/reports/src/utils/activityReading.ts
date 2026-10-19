import type { AgentEntry } from "../../../../src/core/activityTypes";

/** A reading older than this says nothing about who is working now. */
export const readingAge = 60_000;

export interface ActivityReading {
	/** False once the reading is too old to describe the present. */
	current: boolean;
	/** Agents working by this reading at this moment; null when that is not known. */
	working: number | null;
	/** What an agent is called now: a recorded end stays, live work is only as good as the reading. */
	label(agent: AgentEntry): string;
}

export { activityReading } from '../components/activity-agents/activityReading';
