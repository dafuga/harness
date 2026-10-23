import { z } from 'zod';

const text = z.string().min(1);
const stated = z.string().nullable();

/** What an agent wrote when it registered. Nothing in it is inferred from the machine. */
export const agentRegistrationSchema = z.strictObject({
	schemaVersion: z.literal(1),
	id: text,
	label: text,
	provider: stated,
	model: stated,
	/** The process the owner named as the agent, with when the system says it started. */
	pid: z.number().int().positive().nullable(),
	processStartedAt: stated,
	registeredAt: text,
	/** How long after a heartbeat the agent may be quiet and still count as working. */
	ttlSeconds: z.number().int().positive()
});
/** The latest sign of work of an agent, with what it says it is working on now. */
export const agentBeatSchema = z.strictObject({
	at: text,
	branch: stated,
	task: stated,
	loop: stated,
	units: z.array(text)
});
/** How an agent ended. Once written it is never replaced. */
export const agentEndSchema = z.strictObject({
	at: text,
	status: z.enum(['completed', 'failed']),
	outcome: stated
});

export type {
	AgentRegistration,
	AgentBeat,
	AgentEnd,
	AgentState,
	AgentEntry,
	AgentRoster,
	FileChange,
	CommittedFile,
	LoopUsage,
	WorkItem,
	ProjectActivity,
	WorktreeState,
	LiveActivity
} from './activityTypes.types';
