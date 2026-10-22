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

export type AgentRegistration = z.infer<typeof agentRegistrationSchema>;
export type AgentBeat = z.infer<typeof agentBeatSchema>;
export type AgentEnd = z.infer<typeof agentEndSchema>;
export type AgentState = 'working' | 'stale' | 'gone' | 'completed' | 'failed';

/** One registered agent as a reader sees it, with whether it is working now and why. */
export interface AgentEntry {
	id: string;
	label: string;
	provider: string | null;
	model: string | null;
	/** The checkout it registered in, by its directory name. */
	worktree: string;
	branch: string | null;
	task: string | null;
	loop: string | null;
	units: string[];
	/** Stated assignments that the unit registry of the repository does not hold. */
	unknownUnits: string[];
	registeredAt: string;
	heartbeatAt: string;
	/** When its allowance after that heartbeat ends; a reader may call it stale from then on. */
	expiresAt: string;
	state: AgentState;
	detail: string;
	finishedAt?: string;
	outcome?: string;
}

/** `never-used`: no agent ever registered here, so the number working is not known. */
export interface AgentRoster {
	tracking: 'available' | 'never-used';
	working: number | null;
	/** Registrations that are damaged and could not be read; they are counted, never guessed. */
	unreadable: number;
	roster: AgentEntry[];
}

export interface FileChange {
	path: string;
	status: string;
	units: string[];
}
export interface CommittedFile extends FileChange {
	commit: string;
	committedAt: string;
}
export interface LoopUsage {
	template: string;
	loops: number;
	complete: number;
	open: number;
	lastUsedAt: string;
	names: string[];
}
export interface WorkItem {
	commit: string;
	subject: string;
	author: string;
	committedAt: string;
	branches: string[];
	/** Units that own a file the commit changed; the first few when there are many. */
	units: string[];
	/** How many units own a file the commit changed. */
	unitCount: number;
	reasons: Array<{ unit: string; behavior: string }>;
	reasonCount: number;
	files: number;
}

/**
 * What a project did, from Git: `recorded` when built into a history index, `live` when read
 * from a checkout. It holds committed work only; nothing in it depends on the machine.
 */
export interface ProjectActivity {
	schemaVersion: 1;
	kind: 'recorded' | 'live';
	repository: { name: string; branch: string | null; head: string | null };
	/** The newest commit the activity covers. */
	asOf: { commit: string; committedAt: string } | null;
	loops: { total: number; types: LoopUsage[] };
	work: WorkItem[];
	files: CommittedFile[];
}

export interface WorktreeState {
	name: string;
	branch: string | null;
	head: string | null;
	primary: boolean;
	/** What is changed in this checkout and not committed. */
	changes: FileChange[];
	truncated: boolean;
}

/** What only a running Harness can say about its own repository, at the moment it is asked. */
export interface LiveActivity {
	sampledAt: string;
	worktrees: WorktreeState[];
	agents: AgentRoster;
}
