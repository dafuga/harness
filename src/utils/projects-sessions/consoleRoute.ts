export const consoleViews = ['map', 'compare', 'history', 'growth', 'activity'] as const;

export type ConsoleView = (typeof consoleViews)[number];

/** One page of the console: where it is in history and what is selected on it. */
export interface ConsoleRoute {
	/** Null for a commit that no branch reaches; no branch is invented for it. */
	branch: string | null;
	commit: string;
	view: ConsoleView;
	/** The commit a comparison starts from. */
	base?: string;
	/** The verification record shown in the history view. */
	record?: string;
	unit?: string;
}

export { consoleRoute } from './console-canonical/consoleRoute';
export { consoleRoutePath } from '../../../packages/reports/src/components/project-activity/consoleRoute';
