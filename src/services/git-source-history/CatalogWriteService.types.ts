// @harness-uid u_j3jguhuan6
import type { RevisionRegistry } from '../../utils/revisionRegistry';

export interface CatalogSnapshot {
	commit: string;
	registry: RevisionRegistry;
}
