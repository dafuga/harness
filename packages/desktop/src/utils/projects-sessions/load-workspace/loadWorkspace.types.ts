import type { ProjectSnapshot } from '../../../models/development-tooling/Desktop.types';
import type { EntityDetail } from '../../../models/development-tooling/Desktop.types';
import type { ProjectCapabilities } from '../../../models/projects-sessions/ProjectContext.types';
import type { OfflineView } from '../cache-status/cacheStatus';

export interface LoadedWorkspace {
	snapshot: ProjectSnapshot;
	entity: EntityDetail | null;
	capabilities: ProjectCapabilities;
	offline: OfflineView | null;
}

/** The project the bridge was last told to select; null while that is not known. */
export interface ProjectSelection {
	id: string | null;
}
