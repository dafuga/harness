import type { entityCatalog } from '../../packages/reports/src/utils/explorer-ui/entityCatalog';
import type { explorerEntities } from '../../packages/reports/src/utils/explorer-ui/explorerEntities';

export type Category = Parameters<typeof entityCatalog>[1];

export type Options = Parameters<typeof entityCatalog>[3];

export type Entity = ReturnType<typeof explorerEntities>[number];

export type Row = ReturnType<typeof entityCatalog>[number];
