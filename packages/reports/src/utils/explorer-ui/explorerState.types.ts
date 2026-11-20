// @harness-uid u_i4vqq2pyhj
import type { HarnessRecord } from '../../models/explorer-ui/Harness.types';
import type { HarnessScenario } from '../../models/explorer-ui/Harness.types';
import type { CoverageStanding } from '../../models/explorer-ui/Explorer.types';

export type Result = HarnessRecord['scenarios'][number];

export type Told = [CoverageStanding, string];

/** One declared scenario with its result, and the commit its captures must be of. */
export interface Judged {
	declared: HarnessScenario;
	result: Result;
	record: HarnessRecord;
	bound: string;
}

export type Users = Map<string, string[]>;

/** A video clip the scenario's manifest declares. */
export type DeclaredVideoClip = NonNullable<HarnessScenario['video']>['clips'][number];

/** One slot a declared evidence must fill: a viewport, and the clip recorded there, if any. */
export interface ExpectedCaptureSlot {
	id: string;
	kind: string;
	viewport: string | null;
	clip?: DeclaredVideoClip;
}
