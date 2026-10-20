import type { IndexedRevision } from '../core/historyIndexTypes';
export interface CatalogRevisionAttributes {
	id: string;
	subject: string;
	committedAt: string;
	coverage: string;
	registryAvailable: boolean;
	data: IndexedRevision;
}
export type CatalogRevisionCreateInput = CatalogRevisionAttributes;
export type CatalogRevisionUpdateInput = Partial<Omit<CatalogRevisionAttributes, 'id'>>;
