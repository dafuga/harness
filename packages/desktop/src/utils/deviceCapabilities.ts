import type { ProjectCapabilities } from '../models/ProjectContext.types';

/** What an approved phone may do in a granted project: everything, or reading and comments. */
export function deviceCapabilities(agents: boolean): ProjectCapabilities {
	return {
		comments: true,
		agents,
		planning: agents,
		approval: agents,
		source: 'local',
		reason: agents
			? 'Comments are saved on the computer as pending drafts until connected.'
			: 'This device was approved to read and comment only.'
	};
}
