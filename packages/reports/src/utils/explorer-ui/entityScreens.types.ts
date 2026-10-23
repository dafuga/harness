import type { Evidence } from '../../models/reports-media/Report.types';
import type { ExplorerCapture } from '../../models/explorer-ui/Explorer.types';

export interface ScreenOption {
	scenario: string;
	title: string;
	/** The states the scenario requires; one it marks missing or inapplicable is not offered. */
	states: string[];
	viewports: Array<{ id: string; label: string; size: string }>;
}

export interface ScreenPick {
	scenario: string;
	state: string;
	viewport: string;
}

export interface EntityScreens {
	/** The parent's capture at a selected commit; absent at the branch tip. */
	before?: Evidence;
	/** The capture of the shown revision, or the stated gap when it has none. */
	after: Evidence;
	/** True only when the shown capture is usable and was taken for the shown revision itself. */
	fresh: boolean;
	/** The revision an inherited capture was taken at. */
	origin?: string;
}

export type Phase = NonNullable<Evidence['phase']>;

export interface Pane {
	found?: ExplorerCapture;
	shown: Evidence;
}
