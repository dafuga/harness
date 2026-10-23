import type { ExplorerLocation } from '../src/models/Explorer.types';

export type UsageRoute = Pick<ExplorerLocation, 'category' | 'entity' | 'commit'>;
