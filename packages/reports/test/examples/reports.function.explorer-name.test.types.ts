import type { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { explorerAppRoute } from '../../src/utils/explorer-ui/explorerName';

export type Cases = Parameters<typeof recordExampleCases>[1];

export type Route = Parameters<typeof explorerAppRoute>[0];
