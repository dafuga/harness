import type { ExplorerCategory } from '../explorer-route/explorerTabs';
import type { ExplorerTab } from '../explorer-route/explorerTabs';
import type { explorerSections } from './explorerRoute';

export type ExplorerScreen = 'styles' | 'dependencies';

export type ExplorerSection = (typeof explorerSections)[number];

/** One address of the explorer: where it is in history and which entity it shows there. */
export interface ExplorerLocation {
	/** Null for a commit that no branch reaches; no branch is invented for it. */
	branch: string | null;
	/** The full hash of a selected commit; null shows the branch at whatever its tip is. */
	commit: string | null;
	category: ExplorerCategory;
	/** A project-wide code screen, separate from the entity categories. */
	screen?: ExplorerScreen;
	/** The id of a unit; absent on the index of a category. */
	entity?: string;
	/** A callable within its owning unit, resolved at the selected revision. */
	helper?: string;
	/** Absent for the overview of the entity. */
	section?: ExplorerSection;
	/** A tab of the section other than its default one. */
	tab?: ExplorerTab;
}

export interface Scope {
	branch: string | null;
	commit: string | null;
	rest: string[];
}

export type Selection = Pick<ExplorerLocation, 'entity' | 'section'> | null;
