import type { ExplorerArtifactBehavior } from '../../../models/explorer-ui/Explorer.types';

export type Fields = Record<string, unknown>;

export type Assertion = ExplorerArtifactBehavior['assertions'][number];
