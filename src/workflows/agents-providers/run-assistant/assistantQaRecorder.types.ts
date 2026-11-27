// @harness-uid u_ra7tnn4vxj
import type { QaRunbookStep, QaTask } from '../../../core/agents-providers/qaThread.types';
import type { NativeRecordingOptions } from '../../../services/verification-evidence/NativeVideoRecorderService.types';

export interface AssistantQaRecipeInput {
	stagingUrl: string;
	deployedRevision: string;
	task: QaTask;
	steps: readonly QaRunbookStep[];
}

/** Operator-reviewed local recipes use a disposable staging account and assert every recorded state. */
export interface AssistantQaRecipe {
	revision: string;
	prepare: NativeRecordingOptions['prepare'];
	perform: NativeRecordingOptions['perform'];
	reset: NonNullable<NativeRecordingOptions['reset']>;
}

export type PlanAssistantQaRecording = (
	input: AssistantQaRecipeInput
) => Promise<AssistantQaRecipe>;
