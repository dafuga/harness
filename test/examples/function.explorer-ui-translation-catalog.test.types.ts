import type { translationCatalog } from '../../src/services/explorer-ui/revision-detail-service/translationCatalog';

export type Tree = Parameters<typeof translationCatalog>[0];

export type Units = Parameters<typeof translationCatalog>[1];

export type Entry = Awaited<ReturnType<Tree['list']>>[number];
