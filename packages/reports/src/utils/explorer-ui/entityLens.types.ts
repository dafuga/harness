import type { ExplorerLocation } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerRelations } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerEvidence } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerBehavior } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerHistoryRow } from '../../models/explorer-ui/Explorer.types';
import type { ExplorerEntity } from '../../models/explorer-ui/Explorer.types';
import type { HarnessUnit } from '../../models/explorer-ui/Harness.types';

/**
 * What the host works out for the content. The content decides none of it: which commits
 * belong to the history of an entity, what proves it and what it relates to are answered by the
 * host, from the one history it holds, and the content renders the answers.
 */
export interface EntityLens {
	/** The full address of a location, so that every link is a real one. */
	href(to: ExplorerLocation): string;
	relations(id: string): ExplorerRelations;
	/** The captures an entity is shown with: one side at the tip, the parent's and its own at a commit. */
	evidence(unit: HarnessUnit): ExplorerEvidence;
	/** The headless results of an entity on both sides and whether they differ. */
	behavior(unit: HarnessUnit): ExplorerBehavior;
	/** The shown commit and its ancestors as the history knows them for an entity, newest first. */
	history(id: string): ExplorerHistoryRow[];
}

/** How a component reaches another place: where it is, the address of a place, and going there. */
export interface EntityNav {
	/** Opens one owned file without changing the current address. */
	source?(entity: ExplorerEntity, title?: string, trigger?: HTMLElement, path?: string): void;
	route: ExplorerLocation;
	href(to: ExplorerLocation): string;
	go(to: ExplorerLocation): void;
}

export interface EntityLabel {
	title: string;
	one: string;
	subtitle: string;
}

export type Target = Partial<
	Pick<ExplorerLocation, 'commit' | 'category' | 'entity' | 'helper' | 'section' | 'tab'>
>;
