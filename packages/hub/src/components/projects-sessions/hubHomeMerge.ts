// @harness-uid u_dinthu4j65
import type {
	HomeAgent,
	HomeProviderReadings,
	HomeSubscription,
	OwnerHomeSnapshot
} from '$reports/lib/projects-sessions/hub-home/hubHome.types';

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

function mergeAgents(all: HomeAgent[]): HomeAgent[] {
	const wins = (a: HomeAgent, b: HomeAgent) =>
		precedence[a.state] !== precedence[b.state]
			? precedence[a.state] < precedence[b.state]
			: Date.parse(a.since) > Date.parse(b.since);
	return newest(all, (agent) => agent.id, wins).sort(
		(a, b) => precedence[a.state] - precedence[b.state] || a.name.localeCompare(b.name)
	);
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

function betterOverview(a: OwnerHomeSnapshot['overview'], b: OwnerHomeSnapshot['overview']) {
	if (a.status !== 'ready') return false;
	if (b.status !== 'ready') return true;
	return (
		a.liveSessions > b.liveSessions ||
		(a.liveSessions === b.liveSessions && a.projects.length > b.projects.length)
	);
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
	return {
		overview,
		agents: mergeAgents(snapshots.flatMap((entry) => entry.agents)),
		plans: newest(
			snapshots.flatMap((entry) => entry.plans),
			(plan) => plan.id,
			(a, b) => Date.parse(a.updatedAt) > Date.parse(b.updatedAt)
		),
		scheduled: newest(
			snapshots.flatMap((entry) => entry.scheduled),
			(run) => `${run.source}|${run.id}`,
			() => false
		),
		providers: {
			quota: mergeQuota(providers.map((entry) => entry.quota)),
			...mergeRoutines(providers)
		}
	};
}
