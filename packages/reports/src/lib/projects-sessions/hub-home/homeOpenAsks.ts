// @harness-uid u_nz6sw6sbnv
import { trackerStructuredAsk } from '../../../../../../src/utils/projects-sessions/trackerStructuredAsk';
import type { TrackerItemRecord } from '../project-overview/projectOverviewTracker.types';
import { homeText } from './homeTrackerText';
import type { HomeAgent, HomeOpenAsk } from './hubHome.types';

const listed = 100;

/**
 * The one list "needs you" counts and shows: every open structured ask, oldest first. The caller
 * passes only items that may be displayed.
 */
export function buildHomeOpenAsks(items: TrackerItemRecord[]): HomeOpenAsk[] {
	return items
		.filter((item) => trackerStructuredAsk(item))
		.sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at) || a.id.localeCompare(b.id))
		.slice(0, listed)
		.map((item) => {
			const agent = homeText(item.agent, 200) ?? 'Tracker';
			return {
				itemId: item.id,
				agentId: agent,
				agentName: agent,
				title: homeText(item.title, 500) ?? 'Untitled task',
				question: homeText(item.question, 2000) ?? '',
				options: item.options ?? [],
				...(item.confirm && { confirm: item.confirm }),
				since: new Date(item.updated_at).toISOString()
			};
		});
}

/** An older Mac sends no list, so only its agents' own questions that are structured count. */
export function agentOpenAsks(agents: HomeAgent[]): HomeOpenAsk[] {
	return agents.flatMap((agent) => {
		const { itemId, question, options } = agent;
		if (!itemId || !question || !options) return [];
		if (!trackerStructuredAsk({ needs_daniel: true, question, options })) return [];
		return [
			{
				itemId,
				agentId: agent.id,
				agentName: agent.name,
				title: agent.task,
				question,
				options,
				...(agent.confirm && { confirm: agent.confirm }),
				since: agent.since
			}
		];
	});
}

/** An agent needs you exactly when the list has an ask of its own; otherwise it shows no question. */
export function withListedAsk(agent: HomeAgent, asks: HomeOpenAsk[]): HomeAgent {
	const mine = asks.filter((ask) => ask.agentId === agent.id);
	const shown = mine.some((ask) => ask.itemId === agent.itemId && ask.question === agent.question);
	const plain = shown ? agent : withoutQuestion(agent);
	if (mine.length) return { ...plain, state: 'needs-you' };
	if (plain.state !== 'needs-you') return plain;
	return { ...plain, state: agent.sessions > 0 ? 'working' : 'idle' };
}

function withoutQuestion(agent: HomeAgent): HomeAgent {
	const plain = { ...agent, question: null };
	delete plain.options;
	delete plain.confirm;
	return plain;
}
