import type { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { HarnessScenario, HarnessCapture } from '../../src/models/explorer-ui/Harness.types';
import type { scenarioFor, Judged } from '../../src/utils/explorer-ui/explorerState';
import type { CoverageStanding } from '../../src/models/explorer-ui/ExplorerEvidence.types';

export type Case = Parameters<typeof recordExampleCases>[1][number];

export type State = HarnessScenario['states'][number];

export type Selection = [string, string, Parameters<typeof scenarioFor>[2], string[]];

export type Recorded = Array<{ id: string; coverage: string; captures: HarnessCapture[] }>;

export type Judging = [string, Judged | null, State, CoverageStanding, string[]?];
