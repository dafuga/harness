import type { ExplorerEntity, ExplorerSupport } from '../models/Explorer.types';
import { type HarnessIconName } from './harnessIcons';

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
	/** What it uses, kind by kind; a kind it uses nothing of is left out. */
	uses: UsageGroup[];
	/** What it uses that is none of the five kinds. */
	other: ExplorerSupport[];
	/** How many things it uses in all. */
	count: number;
}

export { entityUsage } from '../components/harness/entity-relations/entityUsage';
