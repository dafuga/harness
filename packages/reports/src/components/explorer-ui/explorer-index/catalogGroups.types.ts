// @harness-uid u_gk6ius7tb2
import type { CatalogRow } from '../../../utils/explorer-ui/entityCatalog';

export interface CatalogSection {
	id: string;
	title: string;
	rows: CatalogRow[];
	source?: string;
}
