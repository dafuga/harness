// @harness-uid u_burc3b5edi
export interface CatalogMetadataAttributes {
	id: string;
	schemaVersion: number;
	digest: string;
}
export type CatalogMetadataCreateInput = CatalogMetadataAttributes;
export type CatalogMetadataUpdateInput = Partial<Omit<CatalogMetadataAttributes, 'id'>>;
