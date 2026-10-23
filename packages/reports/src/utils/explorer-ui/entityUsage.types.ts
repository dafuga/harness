import type { ExplorerEntity, ExplorerSupport } from '../../models/explorer-ui/Explorer.types';
import type { HarnessIconName } from './harnessIcons';

/** One kind of thing an entity uses, with the entities of that kind. */
export interface UsageGroup {
	title: string;
	icon: HarnessIconName;
	items: ExplorerEntity[];
}

/** What an entity is shown with of the things around it, one list for each direction. */
export interface EntityUsage {
	/** What uses it: the pages that show it first, then everything else, each once. */
	usedIn: ExplorerEntity[];
	usedInGroups: UsageGroup[];
	/** What it uses, kind by kind; a kind it uses nothing of is left out. */
	uses: UsageGroup[];
	/** What it uses that is none of the five kinds. */
	other: ExplorerSupport[];
	/** How many things it uses in all. */
	count: number;
}

/** One of `other` on its module card: its own name and users, with no kind or page invented. */
export interface SupportRow {
	support: ExplorerSupport;
	id: string;
	name: string;
	/** What uses it at the shown revision, as a catalog row lists them. */
	usedIn: ExplorerEntity[];
	/** A private function opens its existing page under Functions; any other unit has none. */
	opens: 'functions' | null;
}
