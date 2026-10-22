import type { RevisionRegistry } from '../../utils/revisionRegistry';
export interface CatalogEntityAttributes {
	id: string;
	unitId: string;
	version: string;
	kind: string;
	title: string;
	responsibility: string;
	data: RevisionRegistry['units'][number];
}
export type CatalogEntityCreateInput = CatalogEntityAttributes;
export type CatalogEntityUpdateInput = Partial<Omit<CatalogEntityAttributes, 'id'>>;
