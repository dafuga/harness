import type { CreatedEntity } from '../../../../models/development-tooling/DesktopBridge.types';
import type { RunContext } from '../../../../models/development-tooling/RunContext.types';
import type { hostChanges } from '../../../../utils/development-tooling/hostChanges';

/** What a creation run has written so far: the draft it names, and the run of its thread. */
export interface Progress {
	created: CreatedEntity | null;
	thread: Omit<RunContext, 'entity'> | null;
}

export type Host = ReturnType<typeof hostChanges>;
