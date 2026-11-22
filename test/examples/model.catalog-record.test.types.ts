import type { CatalogRecord } from '../../src/models/git-source-history/CatalogRecord';

export type Adapter = Parameters<typeof CatalogRecord.find>[0];
