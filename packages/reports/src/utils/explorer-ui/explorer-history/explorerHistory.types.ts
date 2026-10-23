import type { ExplorerHistoryRow } from '../../../models/explorer-ui/Explorer.types';

export type Measured = NonNullable<ExplorerHistoryRow['measured']>;

export type Told = Pick<ExplorerHistoryRow, 'standing' | 'change' | 'gap'>;
