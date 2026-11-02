// @harness-uid u_w5a5tl3hd5
export interface CatalogBranchAttributes {
	id: string;
	head: string;
}
export type CatalogBranchCreateInput = CatalogBranchAttributes;
export type CatalogBranchUpdateInput = Partial<Omit<CatalogBranchAttributes, 'id'>>;
