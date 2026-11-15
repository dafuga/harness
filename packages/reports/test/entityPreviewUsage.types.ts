import type { ExplorerLocation } from '../src/models/explorer-ui/Explorer.types';

export type UsageRoute = Pick<ExplorerLocation, 'category' | 'entity' | 'commit'>;
