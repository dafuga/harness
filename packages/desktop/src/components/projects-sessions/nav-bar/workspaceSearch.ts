import type { WorkspaceSearch } from '../../../utils/projects-sessions/workspaceSearch';
import type { SearchEntry } from '../../../../../reports/src/utils/entitySearch';
import { explorerName } from '../../../../../reports/src/utils/explorerName';
import type {
	CatalogEntity,
	ProjectSnapshot
} from '../../../models/development-tooling/Desktop.types';
import { workspacePath } from '../../../utils/projects-sessions/workspaceRoute';

/** The catalog keeps no contract, so a workspace entry has no contract names to search. */
function entry(entity: CatalogEntity, commit: string): SearchEntry {
	const { id, category, summary } = entity;
	return { id, category, name: explorerName(entity), purpose: summary, terms: [], commit };
}

/**
 * The search of the top bar for the shown project and revision. While the workspace reads
 * another one it offers nothing, so no result or label of the project or commit left is shown.
 */
export function workspaceSearch(shown: {
	snapshot: ProjectSnapshot | null;
	pinned: boolean;
	busy: boolean;
}): WorkspaceSearch {
	const { snapshot, pinned, busy } = shown;
	if (!snapshot || busy)
		return { entries: null, scope: { label: 'Reading the project', pinned: null }, at: () => null };
	const { project, revision } = snapshot;
	const kept = pinned || !revision.atTip ? revision.commit : null;
	const commit = kept?.slice(0, 7) ?? null;
	const label = commit
		? `${project.name} at commit ${commit}`
		: `${project.name} at the tip of ${revision.branch}`;
	const entries = snapshot.entities.map((entity) => entry(entity, revision.commit));
	const held = new Set(entries);
	const at = (found: SearchEntry) =>
		held.has(found)
			? workspacePath({
					...{ projectId: project.id ?? null, branch: revision.branch, commit: kept },
					...{ category: found.category, entityId: found.id }
				})
			: null;
	return { entries, scope: { label, pinned: commit }, at };
}
