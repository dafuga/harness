import type { ExplorerLocation } from '../../models/explorer-ui/Explorer.types';

export type Place = Pick<ExplorerLocation, 'section' | 'tab'>;
