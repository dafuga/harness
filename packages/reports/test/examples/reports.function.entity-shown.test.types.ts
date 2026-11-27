import type { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { entityShown } from '../../src/utils/explorer-ui/entityShown';
import type { revision } from '../entityFixture';

export type Cases = Parameters<typeof recordExampleCases>[1];

export type Shown = Parameters<typeof entityShown>[0];

export type Entity = Parameters<typeof entityShown>[1];

export type Head = ReturnType<typeof revision>;
