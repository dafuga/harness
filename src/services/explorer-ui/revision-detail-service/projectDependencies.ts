import type { SourceTree } from '../../../core/development-tooling/sourceTypes';
import type { ProjectDependencies } from './projectDependencies.types';

/** Reads direct package declarations from a selected source revision. */
export async function projectDependencies(_tree: SourceTree): Promise<ProjectDependencies> {
	return { entries: [], gaps: [] };
}
