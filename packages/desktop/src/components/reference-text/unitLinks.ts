import { UnitLink } from '../../utils/unitLinks';
import { explorerName } from '../../../../reports/src/utils/explorerName';
import type { Workspace } from '../../lib/stores/workspace.svelte.ts';
import type { CatalogEntity } from '../../models/Desktop.types.ts';
import { isUnitId } from '../../utils/entityReferences';
import { workspacePath } from '../../utils/workspaceRoute';

/** One id index per catalog that was read, so a thread of many references reads it once. */
const indexes = new WeakMap<CatalogEntity[], Map<string, CatalogEntity>>();

function indexed(entities: CatalogEntity[]): Map<string, CatalogEntity> {
	let index = indexes.get(entities);
	if (!index) indexes.set(entities, (index = new Map(entities.map((unit) => [unit.id, unit]))));
	return index;
}

interface View {
	projectId: string | null;
	branch: string;
	commit: string;
	pinned: boolean;
}

/** The project, branch and commit in view, and whether the address pins that commit. */
function shown(workspace: Workspace): View | null {
	if (!workspace.snapshot) return null;
	const { project, revision } = workspace.snapshot;
	const pinned = workspace.pinned || !revision.atTip;
	return {
		projectId: project.id ?? null,
		branch: revision.branch,
		commit: revision.commit,
		pinned
	};
}

function same(view: View, now: View | null): boolean {
	if (!now || view.projectId !== now.projectId || view.branch !== now.branch) return false;
	return view.commit === now.commit && view.pinned === now.pinned;
}

/**
 * Resolves references against the project and revision in view when it is made: their catalog,
 * and the loaded entity in view, which a thread names before the catalog lists it. Addresses
 * keep that project, branch and pinned commit. While the workspace loads, or once it shows
 * another project, revision or pinning, nothing resolves.
 */
export function unitLinks(
	workspace: Workspace,
	current: CatalogEntity | null = null,
	options: { history?: boolean } = {}
): (id: string) => UnitLink | null {
	const view = shown(workspace);
	const suffix = options.history ? 'history' : null;
	if (!view) return () => null;
	const index = indexed(workspace.snapshot!.entities);
	const loaded = current && current.id === workspace.entity?.id ? current : null;
	return (id) => {
		const unit = index.get(id) ?? (loaded?.id === id ? loaded : undefined);
		if (!unit || !isUnitId(id) || workspace.busy || !same(view, shown(workspace))) return null;
		const { projectId, branch } = view;
		const [commit, category] = [view.pinned ? view.commit : null, unit.category];
		const to = workspacePath({
			projectId: workspace.routeProject === false ? null : projectId,
			branch,
			commit,
			category,
			entityId: unit.id,
			suffix
		});
		return { to, name: explorerName(unit), category };
	};
}
