import type { ExplorerScope } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerLocation } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerCategory } from '../../models/explorer-ui/Explorer.types';
import type { HarnessIndex } from '../../models/explorer-ui/Harness.types';
import type { HarnessRevisionSummary } from '../../models/explorer-ui/Harness.types';
import type { SearchEntry } from './entitySearch';
import type { HarnessIconName } from './harnessIcons';

/** What a host gives the bar of the explorer. */
export interface HarnessNavbarInput {
	/** The mount of the console; the brand leads there while no branch is resolved. */
	base: string;
	/** The repository this website shows; without a name no repository segment is drawn. */
	repository: string | null;
	/** Null while the index loads or the address names nothing: no revision is offered. */
	scope: ExplorerScope | null;
	index: HarnessIndex | null;
	/** The commits of the branch that is shown, newest first. */
	commits: HarnessRevisionSummary[];
	/** The whole address of a location, mount included; every link of the bar is one. */
	href: (to: ExplorerLocation) => string;
	/** A plain click on a link of the bar, or a choice in one of its fields. */
	onroute: (to: ExplorerLocation) => void;
	/** Every entity of the revision in view to search, or null while the host reads it. */
	search?: { entries: SearchEntry[] | null };
}

/** One tab of a row of tabs; with an address it is a link that a new tab can open. */
export interface HarnessTab<View extends string = string> {
	id: View;
	label: string;
	href?: string;
	disabled?: boolean;
}

export interface HarnessShellLink {
	href: string;
	to: ExplorerLocation;
}

export interface HarnessShellCategory {
	id: ExplorerCategory | 'styles' | 'dependencies' | 'modules';
	label: string;
	icon: HarnessIconName;
	active: boolean;
	/** Null, with `to`, while there is no branch and commit to stay in. */
	href: string | null;
	to: ExplorerLocation | null;
}

export interface HarnessShellRevision {
	branch: string;
	commit: string;
	/** The commits to choose from; the viewed one is among them also when no branch lists it. */
	commits: HarnessRevisionSummary[];
	/** Where the tip of the branch is. */
	note: string;
	/** What the viewed commit is to that tip. */
	viewed: string;
	/** The same place on the current branch; null at the tip of it and without a tip. */
	tip: HarnessShellLink | null;
	branchTo: (name: string) => ExplorerLocation;
	commitTo: (commit: string) => ExplorerLocation;
}

export interface HarnessShellView {
	home: { href: string; to: ExplorerLocation | null };
	categories: HarnessShellCategory[];
	modules: HarnessShellCategory[];
	revision: HarnessShellRevision | null;
}
