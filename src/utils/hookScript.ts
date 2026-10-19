

/** Text that marks a hook file as written by Harness. */
export const hookMarker = 'harness-managed hook';

/** Suffix under which a hook that was already installed is kept, unchanged, and still run. */
export const chainedSuffix = '.harness-chained';

/**
 * File in a worktree's own Git directory that opts it into the push stage and holds its command.
 * Every version of Harness has written this one file, so it means a push and nothing else.
 */
export const enabledFile = 'harness-hooks';

/** The stages Harness offers: a push is verified, and the message of a commit is measured. */
export const hookStages = ['pre-push', 'commit-msg'] as const;

export type HookStage = (typeof hookStages)[number];

/**
 * The file that opts a worktree into one stage. The hooks directory is shared, so a stage that
 * is offered later is installed for worktrees that asked an earlier Harness for pushes only:
 * it has a file of its own, and is never started by the file of another stage.
 */
export function stageFile(stage: string): string {
	return stage === 'pre-push' ? enabledFile : `${enabledFile}-${stage}`;
}

export { hookScript, managedHook } from '../services/hook-install-service/hookScript';
