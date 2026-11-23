import type { CatalogRepository } from '../../src/lib/git-source-history/catalog';

export type Options = Parameters<CatalogRepository['entities']>[0];

export type ErrorValue = { name: string; message: string };
