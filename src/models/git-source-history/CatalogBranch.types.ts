export interface CatalogBranchAttributes {
	id: string;
	head: string;
}
export type CatalogBranchCreateInput = CatalogBranchAttributes;
export type CatalogBranchUpdateInput = Partial<Omit<CatalogBranchAttributes, 'id'>>;
