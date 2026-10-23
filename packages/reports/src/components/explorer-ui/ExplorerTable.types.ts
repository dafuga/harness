import type { ExplorerCategory } from '../../models/explorer-ui/Explorer.types';
import type { CatalogRow } from '../../utils/explorer-ui/entityCatalog';

/** Visual catalogs use the shared card rather than this table. */
export type Kind = Exclude<ExplorerCategory, 'pages' | 'components'>;
/** Null selects the shared usage footer; other columns format the row. */
export type Column = [string, ((row: CatalogRow) => string) | null];
