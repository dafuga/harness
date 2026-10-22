export interface CatalogDependencyAttributes {
	id: string;
	entityId: string;
	targetId: string;
	via: string;
}
export type CatalogDependencyCreateInput = CatalogDependencyAttributes;
export type CatalogDependencyUpdateInput = Partial<Omit<CatalogDependencyAttributes, 'id'>>;
