// @harness-uid u_3fnmp7mnr4
import { homeText, openQuestion } from './homeTrackerText';
import { projectOverviewSnapshot } from '../project-overview/projectOverviewSnapshot';
import type {
	TrackerItemRecord,
	TrackerSources
} from '../project-overview/projectOverviewTracker.types';
import type {
	HomeAgent,
	HomePlan,
	HomeRun,
	HomeProviderReadings,
	OwnerHomeSnapshot
} from './hubHome.types';
import { buildHomeAgents } from './homeTrackerAgents';
import { buildHomeOpenAsks } from './homeOpenAsks';
import { homeProviderReadingIsStale } from './homeProviderPayload';

export const noProviders: HomeProviderReadings = { routines: null, quota: null };

function compareRecent(left: TrackerItemRecord, right: TrackerItemRecord) {
	return Date.parse(right.updated_at) - Date.parse(left.updated_at);
}

function listPlans(items: TrackerItemRecord[]): HomePlan[] {
	return items
		.filter((item) => item.kind === 'plan')
		.sort(compareRecent)
		.slice(0, 65)
		.map((plan) => {
			const steps = items
				.filter((item) => item.parent === plan.id)
				.map((item) => ({
					id: item.id,
					title: homeText(item.title, 500) ?? 'Untitled step',
					done: item.status === 'done'
				}));
			return {
				id: plan.id,
				title: homeText(plan.title, 500) ?? 'Untitled plan',
				project: homeText(plan.agent, 200),
				state: planState(plan),
				updatedAt: new Date(plan.updated_at).toISOString(),
				total: steps.length,
				done: steps.filter((step) => step.done).length,
				steps: steps.sort((left, right) => Number(left.done) - Number(right.done)).slice(0, 12)
			};
		});
}

function planState(item: TrackerItemRecord): HomePlan['state'] {
	if (item.status === 'done') return 'done';
	if (item.status === 'in_progress') return 'in-progress';
	if (openQuestion(item) || item.status === 'blocked') return 'in-review';
	return item.resolved && item.answer ? 'approved' : 'draft';
}

function listSchedule(items: TrackerItemRecord[], routines: HomeRun[]) {
	const scheduled = items.flatMap((item): HomeRun[] => {
		const at = item.recurring ? (item.occurrence ?? item.due) : item.due;
		if (!at || item.status === 'done') return [];
		return [
			{
				id: item.id,
				title: homeText(item.title, 500) ?? 'Untitled task',
				at: new Date(at).toISOString(),
				agent: homeText(item.agent, 200),
				machine: homeText(item.computer, 200),
				source: 'tracker',
				recurring: Boolean(item.recurring),
				paused: Boolean(item.scheduleOff)
			}
		];
	});
	return [...scheduled, ...routines]
		.sort((left, right) => left.at.localeCompare(right.at))
		.slice(0, 120);
}

export function buildHomeSnapshot(
	sources: TrackerSources | null,
	providers: HomeProviderReadings,
	now: number
): OwnerHomeSnapshot {
	const items =
		sources?.items.filter(
			(item) => !item.deleted && !item.sensitive && item.status !== 'ignored'
		) ?? [];
	const overview = sources
		? projectOverviewSnapshot(sources, now)
		: { status: 'unavailable' as const };
	const agents: HomeAgent[] = sources ? buildHomeAgents(overview, { ...sources, items }) : [];
	return {
		overview,
		agents,
		openAsks: buildHomeOpenAsks(items),
		plans: listPlans(items),
		scheduled: listSchedule(
			items,
			homeProviderReadingIsStale(providers.routinesReadAt, now) ? [] : (providers.routines ?? [])
		),
		providers
	};
}
