import type { Category } from '../../models/development-tooling/Desktop.types';
import type { routeSuffixes } from './workspaceRoute';

export type RouteSuffix = (typeof routeSuffixes)[number] | null;

/** What a workspace address names. A legacy `/harness` address names no project. */
export interface WorkspaceRoute {
	projectId: string | null;
	branch: string | null;
	commit: string | null;
	category: Category;
	entityId: string | null;
	suffix: RouteSuffix;
}

export type WorkspaceTarget = Pick<WorkspaceRoute, 'category'> & Partial<WorkspaceRoute>;
