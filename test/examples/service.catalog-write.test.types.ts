import type { CatalogWriteService } from '../../src/services/git-source-history/CatalogWriteService';

export type Index = Parameters<CatalogWriteService['replace']>[0];

export type Adapter = ConstructorParameters<typeof CatalogWriteService>[0];

export type Case = { name: string; input: unknown } & ({ output: unknown } | { error: unknown });

export interface Row {
	table: string;
	values: Record<string, unknown>;
}

export interface Fake {
	adapter: Adapter;
	executed: string[];
	rows: Row[];
	transactions: number;
}
