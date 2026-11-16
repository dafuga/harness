// @harness-uid u_63clvffenx
export interface CatalogQuery {
	commit?: string;
	kind?: string;
	search?: string;
	limit?: number;
	offset?: number;
}
/** An unsupported catalog schema version, or invalid catalog pagination. */
export class InvalidCatalogError extends Error {
	override name = 'InvalidCatalogError';
}
