// @harness-uid u_gphcvgm7gv
import type { OverviewCard, OverviewSnapshot } from '../project-overview/projectOverview.types';
import type {
	TrackerItemRecord,
	TrackerSources
} from '../project-overview/projectOverviewTracker.types';
import type { HomeAgent, HomeMessage } from './hubHome.types';
import { homeText, openQuestion } from './homeTrackerText';

const HUB_MESSAGE_PREFIX = 'Hub message: ';

const precedence: Record<HomeAgent['state'], number> = {
	'needs-you': 0,
	working: 1,
	idle: 2,
	offline: 3
};

function messages(item: TrackerItemRecord | undefined, question: string | null): HomeMessage[] {
	if (!item) return [];
	const notes: HomeMessage[] = (item.notes_log ?? []).slice(-5).map((note, index) => {
		const delivered = note.text.startsWith(HUB_MESSAGE_PREFIX);
		const text = delivered ? note.text.slice(HUB_MESSAGE_PREFIX.length) : note.text;
		const from: HomeMessage['from'] = delivered ? 'you' : 'tracker';
		return {
			id: `note-${note.at}-${index}`,
			text: homeText(text, 900) ?? '',
			at: new Date(note.at).toISOString(),
			from
		};
	});
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

function activeItemId(card: OverviewCard): string | undefined {
	const active =
		card.items.find((item) => item.live) ??
		card.items.find((item) => ['in_progress', 'blocked'].includes(item.status));
	return card.attention?.item.id ?? active?.id;
}

function machineFor(
	sources: TrackerSources,
	id: string | undefined,
	item: TrackerItemRecord | undefined
): string | null | undefined {
	const run = sources.runs.find(
		(entry) => entry.item_id === id && entry.ended_at === null && entry.state === 'running'
	);
	return run?.node ?? item?.computer;
}

function homeAgent(card: OverviewCard, sources: TrackerSources): HomeAgent {
	const id = activeItemId(card);
	const item = sources.items.find((candidate) => candidate.id === id);
	const machine = machineFor(sources, id, item);
	const unavailable =
		sources.machines.find((entry) => entry.node === machine)?.status === 'offline';
	const state = agentState(card, Boolean(unavailable));
	const question = item ? openQuestion(item) : null;
	return {
		id: card.agent,
		name: card.agent,
		state,
		itemId: item?.id ?? null,
		task: homeText(item?.title, 500) ?? 'No current Tracker item',
		machine: homeText(machine, 200),
		model: homeText(item?.model, 200),
		since: card.updatedAt,
		question,
		messages: messages(item, question)
	};
}

function agentState(card: OverviewCard, offline: boolean): HomeAgent['state'] {
	if (card.state === 'needs-you') return 'needs-you';
	if (offline) return 'offline';
	if (card.state === 'active') return 'working';
	return 'idle';
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
