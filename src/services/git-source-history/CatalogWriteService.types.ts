import type { RevisionRegistry } from '../../utils/revisionRegistry';

export interface CatalogSnapshot {
	commit: string;
	registry: RevisionRegistry;
}
