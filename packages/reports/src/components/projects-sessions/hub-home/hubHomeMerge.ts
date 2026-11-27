// @harness-uid u_dinthu4j65
import type {
	HomeAgent,
	HomePlan,
	HomeProviderReadings,
	HomeSubscription,
	OwnerHomeSnapshot
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type { HomeLiveOverview } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
import { agentOpenAsks } from '$reports/lib/projects-sessions/hub-home/homeOpenAsks';
import { splitHomeSchedule } from '$reports/lib/projects-sessions/hub-home/homeSchedule';

const precedence: Record<HomeAgent['state'], number> = {
	'needs-you': 0,
	working: 1,
	idle: 2,
	offline: 3
};

function newest<T>(items: T[], key: (item: T) => string, better: (a: T, b: T) => boolean): T[] {
	const kept = new Map<string, T>();
	for (const item of items) {
		const known = kept.get(key(item));
		if (!known || better(item, known)) kept.set(key(item), item);
	}
	return [...kept.values()];
}

/**
 * Computers report the same synced runs, so an agent's live sessions are the most any one of
 * them saw (summing would count each run once per computer), and its tasks are the union.
 */
function withLiveWork(winner: HomeAgent, entries: HomeAgent[]): HomeAgent {
	const tasks = new Map(entries.flatMap((entry) => entry.tasks).map((task) => [task.itemId, task]));
	return {
		...winner,
		sessions: Math.max(...entries.map((entry) => entry.sessions)),
		tasks: [...tasks.values()].slice(0, 5),
		subAgents: {
			sessions: Math.max(...entries.map((entry) => entry.subAgents.sessions)),
			tasks: [
				...new Map(
					entries.flatMap((entry) => entry.subAgents.tasks).map((task) => [task.itemId, task])
				).values()
			].slice(0, 5)
		}
	};
}

function mergeAgents(all: HomeAgent[]): HomeAgent[] {
	const wins = (a: HomeAgent, b: HomeAgent) =>
		precedence[a.state] !== precedence[b.state]
			? precedence[a.state] < precedence[b.state]
			: Date.parse(a.since) > Date.parse(b.since);
	const byId = Map.groupBy(all, (agent) => agent.id);
	return newest(all, (agent) => agent.id, wins)
		.map((winner) => withLiveWork(winner, byId.get(winner.id) ?? [winner]))
		.sort((a, b) => precedence[a.state] - precedence[b.state] || a.name.localeCompare(b.name));
}

/** An ask the Tracker synced to several computers is one decision; its newest copy shows. */
function mergeOpenAsks(snapshots: OwnerHomeSnapshot[]) {
	return newest(
		snapshots.flatMap((entry) => entry.openAsks ?? agentOpenAsks(entry.agents)),
		(ask) => ask.itemId,
		(a, b) => Date.parse(a.since) > Date.parse(b.since)
	).sort((a, b) => Date.parse(a.since) - Date.parse(b.since) || a.itemId.localeCompare(b.itemId));
}

/** A synced reminder shows once, as its newest copy. Undefined when no computer lists any. */
function mergeReminders(snapshots: OwnerHomeSnapshot[]) {
	if (!snapshots.some((entry) => entry.reminders)) return undefined;
	return newest(
		snapshots.flatMap((entry) => entry.reminders ?? []),
		(reminder) => reminder.itemId,
		(a, b) => Date.parse(a.updatedAt) > Date.parse(b.updatedAt)
	).sort((a, b) => a.at.localeCompare(b.at) || a.itemId.localeCompare(b.itemId));
}

function mergeQuota(all: (HomeSubscription[] | null)[]): HomeSubscription[] | null {
	const lists = all.filter((list): list is HomeSubscription[] => Array.isArray(list));
	if (!lists.length) return null;
	return newest(
		lists.flat(),
		(subscription) => subscription.id,
		(a, b) => Date.parse(a.readAt) > Date.parse(b.readAt)
	);
}

function mergeRoutines(
	all: HomeProviderReadings[]
): Pick<HomeProviderReadings, 'routines' | 'routinesReadAt'> {
	const read = all.filter((entry) => Array.isArray(entry.routines));
	if (!read.length) return { routines: null, routinesReadAt: null };
	const latest = read
		.map((entry) => entry.routinesReadAt)
		.filter((at): at is string => typeof at === 'string')
		.sort()
		.at(-1);
	const runs = read.flatMap((entry) => entry.routines ?? []);
	const routines = newest(
		runs,
		(run) => run.id,
		() => false
	);
	return { routines: routines as typeof runs, routinesReadAt: latest ?? null };
}

function newerPlan(candidate: HomePlan, known: HomePlan) {
	const difference = Date.parse(candidate.updatedAt) - Date.parse(known.updatedAt);
	if (difference !== 0) return difference > 0;
	return Boolean(candidate.planning && !known.planning);
}

function betterOverview(a: OwnerHomeSnapshot['overview'], b: OwnerHomeSnapshot['overview']) {
	if (a.status !== 'ready') return false;
	if (b.status !== 'ready') return true;
	return (
		a.liveSessions > b.liveSessions ||
		(a.liveSessions === b.liveSessions && a.projects.length > b.projects.length)
	);
}

/** @pure The newest Tracker change a computer's overview has seen. */
function newestChange(overview: HomeLiveOverview) {
	return Math.max(0, ...overview.projects.map((project) => Date.parse(project.updatedAt)));
}

/**
 * Computers read the same synced Tracker, so their overviews are never added together: the one
 * holding the newest change is shown whole, so an ended run cannot return from one still behind.
 */
function mergeLiveOverview(snapshots: OwnerHomeSnapshot[]): HomeLiveOverview | undefined {
	return snapshots
		.flatMap((entry) => entry.liveOverview ?? [])
		.sort(
			(a, b) => newestChange(b) - newestChange(a) || Date.parse(b.readAt) - Date.parse(a.readAt)
		)[0];
}

/**
 * One Home view from what each linked computer reported. Work the Tracker syncs between
 * computers appears once: the most urgent, then the most recent, entry of each id wins.
 */
export function mergeHomeSnapshots(snapshots: OwnerHomeSnapshot[]): OwnerHomeSnapshot | null {
	if (!snapshots.length) return null;
	if (snapshots.length === 1) return snapshots[0];
	const overview = snapshots
		.map((entry) => entry.overview)
		.reduce((a, b) => (betterOverview(b, a) ? b : a));
	const providers = snapshots.map((entry) => entry.providers);
	const liveOverview = mergeLiveOverview(snapshots);
	const directory =
		snapshots.find((entry) => entry.liveOverview === liveOverview && entry.projectDirectory)
			?.projectDirectory ?? snapshots.find((entry) => entry.projectDirectory)?.projectDirectory;
	return {
		overview,
		...(directory && { projectDirectory: directory }),
		agents: mergeAgents(snapshots.flatMap((entry) => entry.agents)),
		openAsks: mergeOpenAsks(snapshots),
		reminders: mergeReminders(snapshots),
		plans: newest(
			snapshots.flatMap((entry) => entry.plans),
			(plan) => plan.id,
			newerPlan
		),
		overdue: newest(
			snapshots.flatMap((entry) => entry.overdue ?? []),
			(run) => run.id,
			() => false
		),
		scheduled: newest(
			snapshots.flatMap((entry) => entry.scheduled),
			(run) => `${run.source}|${run.id}`,
			() => false
		),
		providers: {
			quota: mergeQuota(providers.map((entry) => entry.quota)),
			...mergeRoutines(providers)
		},
		liveOverview
	};
}

/** Upcoming and past-due runs; routine runs count only while the routine source is connected. */
export function homeBoard(snapshot: OwnerHomeSnapshot, routinesConnected: boolean, now: number) {
	const scheduled = snapshot.scheduled.filter(
		(run) => routinesConnected || run.source === 'tracker'
	);
	return splitHomeSchedule({ ...snapshot, scheduled }, now);
}
