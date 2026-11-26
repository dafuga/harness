import type { capture } from '../explorerFixture';
import type { explorerBehavior } from '../../src/utils/explorer-ui/explorerBehavior';

export type Shot = ReturnType<typeof capture>;

export type Behavior = ReturnType<typeof explorerBehavior>;

export type Row = Behavior['rows'][number];
