// @harness-uid u_gphcvgm7gv
import type { OverviewCard, OverviewSnapshot } from '../project-overview/projectOverview.types';
import type {
	TrackerItemRecord,
	TrackerSources
} from '../project-overview/projectOverviewTracker.types';
import type { HomeAgent, HomeAgentTask, HomeMessage } from './hubHome.types';
import { homeAskFields } from './homeAskOptions';
import { homeText, openQuestion } from './homeTrackerText';
import { noSubAgents } from './homeDirectAgents';
import { cosChatItem, homeThreadMessages, liveRunId } from './homeTrackerThread';

const precedence: Record<HomeAgent['state'], number> = {
	'needs-you': 0,
	working: 1,
	idle: 2,
	offline: 3
};

function messages(
	item: TrackerItemRecord | undefined,
	question: string | null,
	thread: TrackerItemRecord | undefined
): HomeMessage[] {
	const notes = homeThreadMessages((thread ?? item)?.notes_log);
	if (!item) return notes;
	if (question)
		notes.push({
			id: 'question',
			text: question,
			from: 'agent',
			at: new Date(item.updated_at).toISOString()
		});
	const answer = homeText(item.answer, 900);
	if (!question && answer && item.answeredAt)
		notes.push({
			id: 'answer',
			text: answer,
			from: 'you',
			at: new Date(item.answeredAt).toISOString()
		});
	return notes;
}

function isOffline(sources: TrackerSources, machine: string | null | undefined): boolean {
	return sources.machines.find((entry) => entry.node === machine)?.status === 'offline';
}

/** The item an agent shows: the one needing Daniel, else a live one, else one in progress or blocked. */
function currentWork(card: OverviewCard, sources: TrackerSources) {
	const active =
		card.items.find((item) => item.live) ??
		card.items.find((item) => ['in_progress', 'blocked'].includes(item.status));
	const id = card.attention?.item.id ?? active?.id;
	const item = sources.items.find((candidate) => candidate.id === id);
	const run = sources.runs.find(
		(entry) => entry.item_id === id && entry.ended_at === null && entry.state === 'running'
	);
	return { item, machine: run?.node ?? item?.computer };
}

/** The model the item asks for and the task type that routes it. */
function modelFacts(item: TrackerItemRecord | undefined) {
	return { model: homeText(item?.model, 200), taskType: homeText(item?.taskType, 200) };
}

function homeAgent(card: OverviewCard, sources: TrackerSources): HomeAgent {
	const { item, machine } = currentWork(card, sources);
	const question = item ? openQuestion(item) : null;
	// Chief of Staff is messaged in its own pane, so its thread is its Hub chat, not an item's.
	const thread = card.agent === 'cos' ? cosChatItem(sources.items) : undefined;
	return {
		id: card.agent,
		name: card.agent,
		state: agentState(card, isOffline(sources, machine)),
		sessions: card.liveSessions,
		tasks: liveTasks(card, sources),
		subAgents: noSubAgents(),
		itemId: item?.id ?? null,
		runId: card.agent === 'cos' ? null : liveRunId(sources, item?.id),
		task: homeText(item?.title, 500) ?? 'No current Tracker item',
		machine: homeText(machine, 200),
		...modelFacts(item),
		since: card.updatedAt,
		question,
		...homeAskFields(item, question),
		messages: messages(item, question, thread)
	};
}

/** Working means a run is live now; a project merely touched today is idle. A flag for Daniel outranks both. */
function agentState(card: OverviewCard, offline: boolean): HomeAgent['state'] {
	if (card.state === 'needs-you') return 'needs-you';
	if (card.liveSessions > 0) return 'working';
	return offline ? 'offline' : 'idle';
}

function liveTasks(card: OverviewCard, sources: TrackerSources): HomeAgentTask[] {
	return card.items
		.filter((item) => item.live)
		.slice(0, 5)
		.map((item) => {
			const run = sources.runs.find(
				(entry) => entry.item_id === item.id && entry.ended_at === null && entry.state === 'running'
			);
			return {
				itemId: item.id,
				title: homeText(item.title, 500) ?? 'Untitled task',
				machine: homeText(run?.node, 200)
			};
		});
}

export function buildHomeAgents(overview: OverviewSnapshot, sources: TrackerSources): HomeAgent[] {
	if (overview.status !== 'ready') return [];
	return overview.projects
		.map((card) => homeAgent(card, sources))
		.sort(
			(left, right) =>
				precedence[left.state] - precedence[right.state] || left.name.localeCompare(right.name)
		)
		.slice(0, 50);
}
