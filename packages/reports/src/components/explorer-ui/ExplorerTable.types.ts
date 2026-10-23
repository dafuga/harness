import type { ExplorerCategory } from '../../models/explorer-ui/Explorer.types';
import type { CatalogRow } from '../../utils/explorer-ui/entityCatalog';

/** Pages and components are only ever the shared visual card, never a table row. */
export type Kind = Exclude<ExplorerCategory, 'pages' | 'components'>;

/** A column's words for a row; null for what uses the row, shown as the shared usage footer. */
export type Column = [string, ((row: CatalogRow) => string) | null];
