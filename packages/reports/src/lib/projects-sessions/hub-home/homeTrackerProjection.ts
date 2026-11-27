// @harness-uid u_3fnmp7mnr4
import { trackerPersonalAgent } from '../../../../../../src/utils/projects-sessions/trackerUnattendedHold';
import { listHomeReminders } from './homeReminders';
import { homeText, openQuestion } from './homeTrackerText';
import { projectOverviewSnapshot } from '../project-overview/projectOverviewSnapshot';
import type {
	TrackerItemRecord,
	TrackerSources
} from '../project-overview/projectOverviewTracker.types';
import type {
	HomeAgent,
	HomePlan,
	HomeProviderReadings,
	HomeTrackerProject,
	OwnerHomeSnapshot
} from './hubHome.types';
import { buildHomeAgents } from './homeTrackerAgents';
import { listHomeSchedule } from './homeSchedule';
import { buildHomeOpenAsks } from './homeOpenAsks';
import { homeProviderReadingIsStale } from './homeProviderPayload';
import { cosChatTitle } from './homeTrackerThread';
import { trackerStructuredAsk } from '../../../../../../src/utils/projects-sessions/trackerStructuredAsk';

export const noProviders: HomeProviderReadings = { routines: null, quota: null };

function compareRecent(left: TrackerItemRecord, right: TrackerItemRecord) {
	return Date.parse(right.updated_at) - Date.parse(left.updated_at);
}

function listPlans(items: TrackerItemRecord[]): HomePlan[] {
	return (
		items
			// Chief of Staff's Hub chat is a conversation, shown in its own box, not a plan.
			.filter(
				(item) => item.kind === 'plan' && !(item.agent === 'cos' && item.title === cosChatTitle)
			)
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
					stage: plan.stage ?? undefined,
					planning: plan.planning,
					updatedAt: new Date(plan.updated_at).toISOString(),
					total: steps.length,
					done: steps.filter((step) => step.done).length,
					steps: steps.sort((left, right) => Number(left.done) - Number(right.done)).slice(0, 12)
				};
			})
	);
}

function planState(item: TrackerItemRecord): HomePlan['state'] {
	if (item.status === 'done') return 'done';
	if (item.status === 'in_progress') return 'in-progress';
	if (openQuestion(item) || item.status === 'blocked') return 'in-review';
	return item.resolved && item.answer ? 'approved' : 'draft';
}

export function buildHomeSnapshot(
	sources: TrackerSources | null,
	providers: HomeProviderReadings,
	now: number
): OwnerHomeSnapshot {
	const shown =
		sources?.items.filter(
			(item) => !item.deleted && !item.sensitive && item.status !== 'ignored'
		) ?? [];
	const items = shown.filter((item) => !trackerPersonalAgent(item.agent));
	const overview = sources
		? projectOverviewSnapshot(sources, now)
		: { status: 'unavailable' as const };
	const agents: HomeAgent[] = sources ? buildHomeAgents(overview, { ...sources, items }) : [];
	return {
		overview,
		...(sources && {
			projectDirectory: listTrackerProjects(items),
			reminders: listHomeReminders(shown)
		}),
		agents,
		openAsks: buildHomeOpenAsks(items),
		plans: listPlans(items),
		...listHomeSchedule(
			{ items, runs: sources?.runs ?? [] },
			homeProviderReadingIsStale(providers.routinesReadAt, now) ? [] : (providers.routines ?? []),
			now
		),
		providers
	};
}

function listTrackerProjects(items: TrackerItemRecord[]): HomeTrackerProject[] {
	const groups = new Map<string, TrackerItemRecord[]>();
	for (const item of items) {
		const name = homeText(item.project || item.agent, 200);
		if (!name) continue;
		const rows = groups.get(name) ?? [];
		rows.push(item);
		groups.set(name, rows);
	}
	return [...groups]
		.map(([name, rows]): HomeTrackerProject => {
			const needsYou = rows.filter(trackerStructuredAsk).length;
			const state = needsYou ? 'needs-you' : trackerProjectState(rows);
			return { name, state, needsYou };
		})
		.sort((left, right) => right.needsYou - left.needsYou || left.name.localeCompare(right.name));
}

function trackerProjectState(rows: TrackerItemRecord[]): HomeTrackerProject['state'] {
	if (rows.some(({ status }) => status === 'blocked')) return 'blocked';
	if (rows.some(({ status }) => status === 'in_progress')) return 'active';
	return rows.every(({ status }) => status === 'done') ? 'done' : 'quiet';
}
