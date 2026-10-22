export interface CatalogRevisionEntityAttributes {
	id: string;
	commit: string;
	entityId: string;
}
export type CatalogRevisionEntityCreateInput = CatalogRevisionEntityAttributes;
export type CatalogRevisionEntityUpdateInput = Partial<Omit<CatalogRevisionEntityAttributes, 'id'>>;
