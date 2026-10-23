import type { projectData } from './ui-project-data';

export interface Options {
	id: string;
	name: string;
	branch: string;
	shared?: boolean;
	version?: string;
	plan?: boolean;
	/** Left out of the snapshot, so the workspace has to ask the bridge for them. */
	askCapabilities?: boolean;
}

export type ProjectData = ReturnType<typeof projectData>;
