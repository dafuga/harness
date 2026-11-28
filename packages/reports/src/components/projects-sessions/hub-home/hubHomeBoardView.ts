// @harness-uid u_ycw5bvew23
import {
	compareHomeBoardCards,
	homeBoardColumn
} from '$reports/lib/projects-sessions/hub-home/homeBoardCards';
import type {
	HomeBoardCard,
	HomeBoardColumn
} from '$reports/lib/projects-sessions/hub-home/homeBoard.types';
import type { HomeOpenAsk } from '$reports/lib/projects-sessions/hub-home/hubHome.types';
import type {
	HomeComputer,
	HomeLiveOverview
} from '$reports/lib/projects-sessions/hub-home/homeLive.types';
import type * as View from './hubHomeBoardView.types';

export const boardColumns: { id: HomeBoardColumn; label: string }[] = [
	{ id: 'todo', label: 'To do' },
	{ id: 'progress', label: 'In progress' },
	{ id: 'blocked', label: 'Blocked' },
	{ id: 'done', label: 'Done' }
];

/** An older Mac sends only rows in motion: one card per item, from its most pressing row. */
function cardsFromRows(live: HomeLiveOverview): HomeBoardCard[] {
	const seen = new Set<string>();
	return live.projects.flatMap((project) =>
		project.rows.flatMap((row) => {
			// A finished run of unfinished work says nothing about where the item is now.
			if (seen.has(row.itemId) || (row.state === 'finished' && row.status !== 'done')) return [];
			seen.add(row.itemId);
			return [{ column: homeBoardColumn(row), project: project.agent, row }];
		})
	);
}

/** An ask whose item has no card still has to be answerable from the board. */
function askCard(ask: HomeOpenAsk): HomeBoardCard {
	return {
		column: 'blocked',
		project: ask.agentName,
		row: {
			key: `ask:${ask.itemId}`,
			itemId: ask.itemId,
			title: ask.title,
			state: 'blocked',
			outcome: null,
			status: 'blocked',
			stage: null,
			now: ask.question,
			owner: null,
			computer: null,
			model: null,
			startedAt: null,
			updatedAt: ask.since
		}
	};
}

/** @pure Every card with the open question it waits on; questions sort to the top of Blocked. */
function askedCards(cards: HomeBoardCard[], asks: HomeOpenAsk[]): View.BoardViewCard[] {
	const open = new Map(asks.map((ask) => [ask.itemId, ask]));
	const placed = cards.map((card): View.BoardViewCard => {
		const ask = card.column === 'done' ? undefined : open.get(card.row.itemId);
		return ask ? { ...card, column: 'blocked', ask } : card;
	});
	const listed = new Set(placed.map((card) => card.row.itemId));
	const missing = asks.filter((ask) => !listed.has(ask.itemId));
	return [...placed, ...missing.map((ask) => ({ ...askCard(ask), ask }))].sort(
		(a, b) =>
			Number(Boolean(b.ask)) - Number(Boolean(a.ask)) ||
			(a.ask && b.ask ? a.ask.since.localeCompare(b.ask.since) : compareHomeBoardCards(a, b))
	);
}

/** @pure The columns for one project filter and search, with honest counts. */
export function boardView(
	live: HomeLiveOverview | undefined,
	asks: HomeOpenAsk[],
	filter: View.BoardFilter
): View.BoardView {
	const { project, search } = filter;
	const full = live?.board;
	const cards = askedCards(full?.cards ?? (live ? cardsFromRows(live) : []), asks);
	const query = search.trim().toLowerCase();
	const matches = (card: View.BoardViewCard) =>
		(!project || card.project === project) &&
		(!query ||
			`${card.row.title} ${card.project} ${card.row.itemId}`.toLowerCase().includes(query));
	/** Items the Mac counted but did not send, per column. */
	const unsent = (column: HomeBoardColumn) => {
		if (query || !full) return 0;
		return full.counts
			.filter((count) => !project || count.project === project)
			.reduce((sum, count) => {
				const sent = full.cards.filter((c) => c.project === count.project && c.column === column);
				return sum + Math.max(0, count[column] - sent.length);
			}, 0);
	};
	const columns = boardColumns.map(({ id, label }) => {
		const shown = cards.filter((card) => card.column === id && matches(card));
		return { id, label, cards: shown, total: shown.length + unsent(id) };
	});
	const totals = new Map<string, number>();
	for (const card of cards)
		if (card.column !== 'done') totals.set(card.project, (totals.get(card.project) ?? 0) + 1);
	const unlistedOpen =
		live && !full
			? Math.max(
					0,
					live.projects
						.filter((entry) => !project || entry.agent === project)
						.reduce((sum, entry) => sum + entry.counts.open, 0) -
						cards.filter((card) => card.column === 'todo' && matches(card)).length
				)
			: 0;
	return {
		columns,
		projects: [...totals]
			.map(([name, total]) => ({ name, total }))
			.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
		open: [...totals.values()].reduce((sum, total) => sum + total, 0),
		partial: Boolean(live) && !full,
		unlistedOpen
	};
}

/** @pure Running sessions, split by the model family each run records. */
export function boardSessions(live: HomeLiveOverview | undefined) {
	const running = (live?.projects ?? [])
		.flatMap((project) => project.rows)
		.filter((row) => row.state === 'running');
	const claude = running.filter((row) => /^claude/i.test(row.model ?? '')).length;
	const codex = running.filter((row) => /^(gpt|codex)/i.test(row.model ?? '')).length;
	const hidden = live?.hiddenRuns ?? 0;
	const other = running.length - claude - codex;
	const parts = [
		claude && `${claude} Claude`,
		codex && `${codex} Codex`,
		other && `${other} other`,
		hidden && `${hidden} private`
	].filter(Boolean);
	return { total: running.length + hidden, detail: parts.join(' · ') || 'Nothing running' };
}

const computerStates = {
	ok: 'Healthy',
	busy: 'Busy',
	overloaded: 'High load',
	offline: 'Offline'
} as const;

/** @pure A computer's state word, load share and running sessions, as the Mac reported them. */
export function boardComputer(machine: HomeComputer, live: HomeLiveOverview | undefined) {
	const { loadOne, cores } = machine.resources ?? {};
	const offline = machine.status === 'offline';
	const load =
		!offline && loadOne !== undefined && cores ? Math.round((loadOne / cores) * 100) : null;
	const sessions = (live?.projects ?? [])
		.flatMap((project) => project.rows)
		.filter((row) => row.state === 'running' && row.computer === machine.name).length;
	const running = `${sessions} ${sessions === 1 ? 'session' : 'sessions'}`;
	return {
		name: machine.name,
		status: machine.status,
		word: computerStates[machine.status],
		load,
		detail: offline ? 'Not reachable' : load === null ? running : `${running} · ${load}% load`,
		short: offline ? 'Offline' : load === null ? running : `${load}% load`
	};
}
