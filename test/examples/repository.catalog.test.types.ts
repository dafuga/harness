import type { CatalogRepository } from '../../src/repositories/git-source-history/CatalogRepository';

export type Index = Parameters<CatalogRepository['replace']>[0];

export type Snapshots = Parameters<CatalogRepository['replace']>[1];

export type Unit = Snapshots[number]['registry']['units'][number];
