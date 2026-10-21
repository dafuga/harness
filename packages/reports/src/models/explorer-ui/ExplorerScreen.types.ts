import type { Component } from 'svelte';
import type { EntityLens } from '../../utils/explorer-ui/entityLens';
import type { HarnessClient } from '../../utils/explorer-ui/harnessClient';
import type { ExplorerEntity, ExplorerLocation, ExplorerScope } from './Explorer.types';
import type { HarnessIndex, HarnessRevision } from './Harness.types';

/**
 * What the host of the explorer gives the content of a screen, once the revisions of exactly the
 * shown scope are read. It is written here and not read off a component, so naming it makes a
 * page depend on no renderer.
 */
export interface ExplorerScreenProps {
	index: HarnessIndex;
	/** The revision every contract, measurement and capture on the page is bound to. */
	head: HarnessRevision;
	/** The first parent of a selected commit; null at the branch tip and for a first commit. */
	parent: HarnessRevision | null;
	scope: ExplorerScope;
	/** The address shown: `scope.location`. */
	route: ExplorerLocation;
	/** The units of `head` as the explorer lists them, with those the shown commit removed. */
	entities: ExplorerEntity[];
	/** What the host answers about an entity; a screen works none of it out. */
	lens: EntityLens;
	/** Read only for the commits a history lists. */
	client: Pick<HarnessClient, 'revision'>;
	mediaBase: string;
	onroute: (to: ExplorerLocation) => void;
	/** Empty where the host serves no export. */
	exportHref: string;
}

/**
 * The component that renders one screen. The host has none of its own: the page that mounts the
 * host names it, so what a page is made of is what that page imports.
 */
export type ExplorerScreen = Component<ExplorerScreenProps>;
