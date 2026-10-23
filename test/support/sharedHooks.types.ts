import type { CommandResult } from './cli';

export interface StageStatus {
	stage: string;
	installed: boolean;
	chained: boolean;
	enabled: boolean;
}

export interface SharedStatus {
	installed: boolean;
	enabled: boolean;
	stages: StageStatus[];
}

/** One worktree of the repository whose hooks directory all of them share. */
export interface Worktree {
	root: string;
	/** Its own Git directory, where an opt-in is kept. */
	gitDir: string;
	run(args: string[]): Promise<CommandResult>;
	/** Makes an empty commit as a person does, with the hooks Git runs for one. */
	commit(message: string): Promise<CommandResult>;
	/** Pushes the branch that is checked out, with the hook Git runs for a push. */
	push(): Promise<CommandResult>;
	head(): Promise<string>;
	/** Asks the Harness under test, started in this worktree, and reads what it printed. */
	harness(...args: string[]): Promise<SharedStatus>;
	/** The files that opt this worktree into a stage. */
	optIns(): Promise<string[]>;
}

export interface SharedHooks {
	parent: string;
	hooks: string;
	legacy: Worktree;
	current: Worktree;
	plain: Worktree;
	/** How the worktree of an earlier Harness starts it, as its opt-in recorded it. */
	legacyCommand: string;
	/** The earlier Harness installs its push hook and opts a worktree in, as it did at b4afb74. */
	optInEarlier(tree: Worktree): Promise<void>;
	/** The first release with a second stage installs it: its wrapper, and the one opt-in file. */
	optInFirstRelease(tree: Worktree): Promise<void>;
	/** Opts a worktree in with the Harness under test, started through a recorder. */
	install(tree: Worktree): Promise<SharedStatus>;
	/** What each command line was started with by a hook, in order: its first three words. */
	started(who: 'legacy' | 'current'): Promise<string[]>;
	/** Which hook that was there before ran, and in which worktree, in order. */
	existing(): Promise<string[]>;
	/** Every file of the hooks directory with its mode and the hash of its bytes. */
	snapshot(): Promise<Record<string, string>>;
	dispose(): Promise<void>;
}
