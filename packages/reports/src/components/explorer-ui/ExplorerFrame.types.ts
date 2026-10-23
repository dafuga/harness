import type { ExplorerEntity } from '../../models/explorer-ui/Explorer.types';

export interface Opened {
	entity: ExplorerEntity;
	title: string;
	trigger?: HTMLElement;
	path?: string;
	/** The revision of the screen it was opened on. */
	at: string;
	route: string;
}
