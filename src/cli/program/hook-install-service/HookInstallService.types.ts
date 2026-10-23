import type { HookStage } from '../../../utils/development-tooling/hookScript';

/** One stage as this worktree has it: its shared wrapper, and whether it was asked for here. */
export interface HookStageStatus {
	stage: HookStage;
	installed: boolean;
	chained: boolean;
	/** This worktree opted into this stage; an opt-in for another stage does not count. */
	enabled: boolean;
}

export interface HookStatus {
	/** The pre-push wrapper is present in the hooks directory. */
	installed: boolean;
	/** This worktree opted into pushes, so the pre-push wrapper runs Harness here. */
	enabled: boolean;
	stage: 'pre-push';
	hooksDirectory: string;
	/** A pre-push hook that was there before is kept and runs first. */
	chained: boolean;
	/** Every stage Harness offers, each with its own wrapper, earlier hook and opt-in. */
	stages: HookStageStatus[];
	limitations: string[];
}
