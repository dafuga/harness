import type { ExplorerRelations } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerEntity } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerVerdict } from '../../models/explorer-ui/Explorer.types';
import type { catalogOrders } from './entityCatalog';

export type Relations = Pick<ExplorerRelations, 'pages' | 'usedBy' | 'components'>;

export interface CatalogRow {
	setting?: NonNullable<ExplorerEntity['unit']['configValues']>[number];
	group?: { id: string; title: string };
	helper?: NonNullable<ExplorerEntity['unit']['helpers']>[number];
	/** Revision-scoped consumers for linked usage previews; helper rows keep the first three eligible consumers. */
	usedIn?: ExplorerEntity[];
	entity: ExplorerEntity;
	id: string;
	name: string;
	summary: string;
	/** True when the shown commit changed or added the entity itself. */
	changed: boolean;
	/** True when more than one entity uses it itself, or more than one page shows it. */
	shared: boolean;
	verdict: ExplorerVerdict;
	/** Names of the pages that show it. */
	usedOn: string[];
	/** Names of what uses it directly and is not a page. */
	usedBy: string[];
	/** Names of the components it contains. */
	contains: string[];
	/** The execution targets it declares. */
	targets: string[];
	/** How many components it contains. */
	components: number;
}

export type CatalogOrder = (typeof catalogOrders)[number];

export interface CatalogFilter {
	search: string;
	changedOnly: boolean;
	order: CatalogOrder;
	verification?: string;
	usage?: string;
	groups?: string[];
}
