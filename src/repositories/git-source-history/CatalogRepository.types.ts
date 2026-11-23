// @harness-uid u_63clvffenx
export interface CatalogQuery {
	commit?: string;
	kind?: string;
	search?: string;
	limit?: number;
	offset?: number;
}

export { InvalidCatalogError } from './InvalidCatalogError';
