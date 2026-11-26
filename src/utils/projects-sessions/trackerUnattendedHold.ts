// @harness-uid u_44hv53nfiu
/** Work the launcher never starts by itself. The launcher and Hub Home share these rules. */
const nonWorkAgent =
	/^(?:(?:cos|chief[-_ ]of[-_ ]staff|personal|brainstorm(?:ing)?)(?:$|[-_ ])|(?:daniel|dad|coach|life[-_ ]?coach|claire|boating|doc|email-router|recruiting)$)/i;
const nonWorkTitle = /^\s*(?:decision|brainstorm(?:ing)?)(?::|\s+for\b)/i;
const reminderTitle = /^\s*(?:remind(?:er)?\b|watch:)/i;
const deployTitle = /\bPROD\s+DEPLOY/i;

/** Personal and family agents, including the Chief of Staff's own list. */
export function trackerNonWorkAgent(agent: string | null | undefined): boolean {
	return nonWorkAgent.test((agent ?? '').trim());
}

/**
 * Daniel's own and family items. They show only under Reminders, never in Needs you or project
 * status. Give an item one of these agents to make it personal.
 */
export function trackerPersonalAgent(agent: string | null | undefined): boolean {
	return /^(?:personal(?:$|[-_ ])|dad$|family$)/i.test((agent ?? '').trim());
}

export function trackerReminderTitle(title: string): boolean {
	return reminderTitle.test(title);
}

export function trackerUnattendedHold({
	title,
	owner,
	agent
}: {
	title: string;
	owner?: string | null;
	agent?: string | null;
}): string | null {
	if (deployTitle.test(title)) return 'production deploy requires an explicit launch';
	if (
		reminderTitle.test(title) ||
		nonWorkTitle.test(title) ||
		/^daniel(?: fugere)?$/i.test((owner ?? '').trim())
	) {
		return 'decision or reminder for Daniel';
	}
	return trackerNonWorkAgent(agent) ? 'personal, brainstorming or Chief of Staff agent' : null;
}
