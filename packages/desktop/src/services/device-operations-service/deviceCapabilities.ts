import type { ProjectCapabilities } from "../../models/ProjectContext.types.ts";

/** What an approved phone may do in a granted project: everything, or reading and comments. */
export function deviceCapabilities(agents: boolean, comments = true): ProjectCapabilities {
	agents = agents && comments;
	return {
		comments,
		agents,
		planning: agents,
		approval: agents,
		source: 'local',
		reason: deviceReason(agents, comments)
	};
}

function deviceReason(agents: boolean, comments: boolean): string {
	if (agents) return 'Comments are saved on the computer as pending drafts until connected.';
	if (comments) return 'This device was approved to read and comment only.';
	return 'This device has Read access.';
}
