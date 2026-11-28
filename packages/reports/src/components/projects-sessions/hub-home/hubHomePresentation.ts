// @harness-uid u_okueohjk4j
import { homeProviderReadingIsStale } from '$reports/lib/projects-sessions/hub-home/homeProviderPayload';
import type {
	HomeAgent,
	HomeAgentState,
	HomeLimit,
	HomePlanState,
	HomeSection,
	HomeSubscription
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { OverviewSnapshot } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
import { etaFor } from '$reports/components/projects-sessions/project-overview/projectOverviewPresentation';
import type { OverviewItem } from '$reports/lib/projects-sessions/project-overview/projectOverview.types';
import { when } from './hubHomeTime';

export const sections = {
	agents: { title: 'Agents', noun: 'agents' },
	quota: { title: 'Quota', noun: 'subscriptions' },
	plans: { title: 'Plans', noun: 'plans' },
	scheduled: { title: 'Scheduled', noun: 'scheduled runs' },
	projects: { title: 'Projects', noun: 'projects' },
	wip: { title: 'Work in progress', noun: 'tasks' }
} satisfies Record<HomeSection, { title: string; noun: string }>;

export const agentLabels: Record<HomeAgentState, string> = {
	'needs-you': 'Needs you',
	working: 'Working',
	idle: 'Idle',
	offline: 'Offline'
};
export const agentGroups = Object.keys(agentLabels) as HomeAgentState[];

export const planLabels: Record<HomePlanState, string> = {
	draft: 'Draft',
	'in-review': 'In review',
	approved: 'Approved',
	'in-progress': 'In progress',
	done: 'Done'
};
export const planStates = Object.keys(planLabels) as HomePlanState[];

export const providerNames = { claude: 'Claude Code', codex: 'Codex' } as const;
export const usageLinks = {
	claude: 'https://claude.ai/settings/usage',
	codex: 'https://chatgpt.com/codex/settings/usage'
} as const;

export function count(value: number, singular: string, plural: string = `${singular}s`) {
	return `${value} ${value === 1 ? singular : plural}`;
}

/** Sessions running for an agent now: its own plus those of the sub-agents working under it. */
export function agentSessions(agent: HomeAgent) {
	return agent.sessions + agent.subAgents.sessions;
}

/** Working means a run is live now, even when the agent also has a question for you. */
export function isWorking(agent: HomeAgent) {
	return agentSessions(agent) > 0;
}

/** The task line under an agent: its live sessions and the task being worked, else its latest task. */
export function agentActivity(agent: HomeAgent) {
	if (!isWorking(agent)) return agent.task;
	const total = agentSessions(agent);
	const first = agent.tasks[0]?.title ?? agent.task;
	const more = total > 1 ? ` (+${total - 1} more)` : '';
	const subs = agent.subAgents.sessions
		? ` (${count(agent.subAgents.sessions, 'sub-agent session')})`
		: '';
	return `${count(total, 'session')} running${subs} · ${first}${more}`;
}

/** Leads with live sessions, so it agrees with the live overview's run count just below it. */
export function homeHeadline(
	agents: HomeAgent[],
	liveSessions = 0,
	needs = 0,
	runningAgentCount?: number | null
) {
	const working = agents.filter(isWorking);
	const sessions = Math.max(liveSessions, ...working.map(agentSessions), 0);
	const asks = needs ? `${needs} ${needs === 1 ? 'needs' : 'need'} you` : '';
	if (!sessions) return asks ? `Nothing is running, ${asks}` : 'Nothing is running yet';
	const active = runningAgentCount === undefined ? working.length : runningAgentCount;
	const who = active ? ` for ${count(active, 'agent')}` : '';
	return `${count(sessions, 'session')} running${who}${asks ? `, ${asks}` : ''}`;
}

export function currentAgent(agents: HomeAgent[]) {
	const eligible = agents.filter((agent) => agent.itemId);
	return eligible.find((agent) => agent.state === 'needs-you') ?? eligible[0];
}

export function soonestWork(snapshot: OverviewSnapshot | null) {
	const projects = snapshot?.status === 'ready' ? snapshot.projects : [];
	return projects
		.flatMap((project) =>
			project.items
				.filter((item) => item.status === 'in_progress' || item.status === 'blocked')
				.map((item) => ({ ...item, project: project.agent }))
		)
		.sort((left, right) => {
			const a = left.due ?? '\uffff';
			const b = right.due ?? '\uffff';
			return a.localeCompare(b) || left.title.localeCompare(right.title);
		});
}

export function workSummary(work: ReturnType<typeof soonestWork>) {
	return `${count(work.length, 'task')} across ${count(new Set(work.map((item) => item.project)).size, 'project')}`;
}

/** A numeric balance reads 23,725; small ones keep cents, and words such as Unlimited stay. */
export function creditsLabel(balance: string) {
	const amount = Number(balance);
	if (!Number.isFinite(amount)) return balance;
	const maximumFractionDigits = Math.abs(amount) < 100 ? 2 : 0;
	return new Intl.NumberFormat('en-GB', { maximumFractionDigits }).format(amount);
}

export function warningFor(left: number) {
	if (left < 10) return 'critical' as const;
	if (left < 25) return 'low' as const;
	return null;
}

export function lowestLimit(subscriptions: HomeSubscription[], now: number) {
	return subscriptions
		.filter((subscription) => !staleReading(subscription.readAt, now))
		.flatMap((subscription) =>
			subscription.limits
				.filter((limit) => warningFor(limit.left))
				.map((limit) => ({ subscription, limit }))
		)
		.sort((left, right) => left.limit.left - right.limit.left)[0];
}

export function staleReading(readAt: string | null | undefined, now: number) {
	return homeProviderReadingIsStale(readAt, now);
}

export function missingQuotaProviders(subscriptions: HomeSubscription[]): string[] {
	return (['claude', 'codex'] as const)
		.filter((provider) => !subscriptions.some((subscription) => subscription.provider === provider))
		.map((provider) => providerNames[provider]);
}

export function warningLabel(limit: HomeLimit) {
	if (limit.left <= 0) return 'Out of quota';
	return warningFor(limit.left) === 'critical' ? 'Almost out' : 'Low';
}

export { messageStatusText, pastDueLabel, pastDueSummary } from './hubHomeStatusText';

export function initials(name: string) {
	return name
		.trim()
		.split(/\s+/)
		.filter((_, index, parts) => index === 0 || index === parts.length - 1)
		.map((part) => part.charAt(0))
		.join('')
		.toUpperCase();
}

export function overviewTone(state: HomeAgentState) {
	if (state === 'needs-you') return state;
	return state === 'working' ? 'active' : 'quiet';
}

export function summaryLine(work: ReturnType<typeof soonestWork>, scheduled: number) {
	if (!work.length && !scheduled) return 'No tasks or scheduled runs yet.';
	const projectCount = new Set(work.map((item) => item.project)).size;
	return `${count(work.length, 'task')} in progress across ${count(projectCount, 'project')} · ${count(scheduled, 'scheduled run')}`;
}

export function relativeWhen(time: string, now: number) {
	const minutes = Math.max(0, Math.round((now - Date.parse(time)) / 60000));
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
	return when(time);
}

export function workEta(item: OverviewItem, now: number) {
	const { due } = item;
	if (!due) return { tone: 'none', text: 'No ETA' };
	const minutes = Math.round((Date.parse(due) - now) / 60000);
	const absolute = Math.abs(minutes);
	const span = absolute < 60 ? `${Math.max(1, absolute)}m` : `${Math.floor(absolute / 60)}h`;
	if (Date.parse(due) <= now) return etaFor(item, now);
	if (minutes < 1440) return { tone: 'soon', text: `in ${span}` };
	return { tone: 'scheduled', text: when(due) };
}

/** "1 out of quota · 2 running low"; empty when every limit has room. */
export function lowSummary(limits: HomeLimit[]) {
	const out = limits.filter((limit) => limit.left <= 0).length;
	const low = limits.length - out;
	return [out ? `${out} out of quota` : '', low ? `${low} running low` : '']
		.filter(Boolean)
		.join(' · ');
}

export function quotaSummary(subscriptions: HomeSubscription[], now: number) {
	if (!subscriptions.length) return 'No subscriptions yet';
	const low = subscriptions
		.filter((subscription) => !staleReading(subscription.readAt, now))
		.flatMap((subscription) => subscription.limits.filter((limit) => warningFor(limit.left)));
	return `${count(subscriptions.length, 'subscription')} · ${lowSummary(low) || 'all OK'}`;
}

export { quotaReset, runDay, runTime, when } from './hubHomeTime';
