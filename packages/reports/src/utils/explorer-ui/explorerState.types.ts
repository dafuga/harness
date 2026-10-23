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
