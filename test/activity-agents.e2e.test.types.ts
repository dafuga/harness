/**
 * Who is working in a repository now is what agents say about themselves while they work: a
 * registration, heartbeats and an end. Every checkout of the repository sees the same agents,
 * another repository sees none of them, and what is not known is said instead of counted.
 * Every case may take 60 seconds: each starts several CLI processes, and a loaded machine starts
 * each slowly. That bounds the work of a test. It says nothing of how long an agent may be
 * quiet, which each agent states for itself and which no case here waits out.
 */
export interface Entry {
	id: string;
	label: string;
	provider: string | null;
	model: string | null;
	worktree: string;
	branch: string | null;
	task: string | null;
	loop: string | null;
	units: string[];
	unknownUnits: string[];
	state: string;
	detail: string;
	outcome?: string;
}

export interface Roster {
	tracking: string;
	working: number | null;
	unreadable: number;
	roster: Entry[];
}
