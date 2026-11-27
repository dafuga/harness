// @harness-uid u_dpe5j4r3is
import { DAY_MS, isoTime } from '../project-overview/projectOverviewItems';
import { isIncludedItem } from '../project-overview/projectOverviewPrivacy';
import type {
	IncludedTrackerItem,
	TrackerItemRecord,
	TrackerRunRecord,
	TrackerSources
} from '../project-overview/projectOverviewTracker.types';
import type {
	HomeLiveOverview,
	HomeWorkProject,
	HomeWorkRow,
	HomeWorkState,
	ItemWork
} from './homeLive.types';
import { homeText } from './homeTrackerText';
import { homeWorkNow } from './homeWorkNow';

export const homeLiveLimits = { projects: 200, rows: 100 } as const;
const stateOrder: HomeWorkState[] = ['running', 'offline', 'queued', 'blocked', 'finished'];

const at = (time: number | null | undefined) => (time ? new Date(time).toISOString() : null);

/** The model and effort a run used. */
function runModel(run: TrackerRunRecord | undefined) {
	if (!run?.model) return null;
	return run.effort ? `${run.model}:${run.effort}` : run.model;
}

/** What a run records about itself; without a run, what the item asks for. */
function runFacts(item: TrackerItemRecord, run: Partial<TrackerRunRecord> = {}) {
	return {
		outcome: homeText(run.outcome, 200),
		computer: homeText(run.node ?? item.computer, 200),
		startedAt: at(run.started_at ?? run.queued_at)
	};
}

function workRow({ item }: ItemWork, state: HomeWorkState, run?: TrackerRunRecord): HomeWorkRow {
	return {
		key: run ? `run:${run.node ?? ''}:${run.id}` : `item:${item.id}`,
		itemId: item.id,
		...(run && { runId: run.id }),
		title: homeText(item.title, 500) ?? 'Untitled task',
		state,
		status: item.status,
		stage: item.stage ?? null,
		now: state === 'queued' ? queuedReason(run) : homeWorkNow(item),
		owner: homeText(item.owner, 200),
		model: homeText(runModel(run) ?? item.model, 200),
		updatedAt: isoTime(item.updated_at),
		...runFacts(item, run)
	};
}

function liveState(run: TrackerRunRecord, offline: ReadonlySet<string>): HomeWorkState {
	if (!['running', 'verifying', 'observed'].includes(run.state)) return 'queued';
	return run.node && offline.has(run.node) ? 'offline' : 'running';
}

function endedToday(work: ItemWork) {
	return work.runs
		.filter((run) => run.ended_at !== null && work.now - run.ended_at <= DAY_MS)
		.sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0))[0];
}

function queuedReason(run?: TrackerRunRecord) {
	if (run?.failure_reason === 'Tracker host is at session capacity') return 'Waiting for a slot';
	return homeText(run?.failure_reason, 240) ?? 'Waiting to start';
}

/** The current request can be pending before Tracker creates a run. */
function restingRow(work: ItemWork): HomeWorkRow[] {
	const { item, runs } = work;
	if (item.status === 'blocked') return [workRow(work, 'blocked')];
	const pending =
		item.launchRequested &&
		!runs.some((run) => run.auto_token && run.auto_token === item.launchToken);
	if (pending && (item.status === 'open' || item.status === 'in_progress'))
		return [workRow(work, 'queued')];
	if (item.status === 'in_progress') {
		const last = endedToday(work);
		const reason = homeText(item.blocked_reason ?? last?.failure_reason, 240);
		return [
			{
				...workRow(work, 'blocked'),
				status: 'blocked',
				now: reason ?? 'Waiting for Tracker to reconcile this item'
			}
		];
	}
	const last = endedToday(work);
	return last ? [workRow(work, 'finished', last)] : [];
}

function itemRows(work: ItemWork): HomeWorkRow[] {
	const live = work.runs.filter((run) => run.ended_at === null && run.state !== 'finished');
	if (!live.length) return restingRow(work);
	return live.map((run) => workRow(work, liveState(run, work.offline), run));
}

function byAttention(a: HomeWorkRow, b: HomeWorkRow) {
	return (
		stateOrder.indexOf(a.state) - stateOrder.indexOf(b.state) ||
		b.updatedAt.localeCompare(a.updatedAt) ||
		a.key.localeCompare(b.key)
	);
}

function workProject(agent: string, works: ItemWork[]) {
	const counts = { open: 0, in_progress: 0, blocked: 0, done: 0 };
	for (const { item } of works) counts[item.status] += 1;
	const rows = works.flatMap(itemRows).sort(byAttention);
	const project: HomeWorkProject = {
		agent: homeText(agent, 200) ?? 'No project',
		running: rows.filter((row) => row.state === 'running').length,
		blockedRows: rows.filter((row) => row.state !== 'running' && row.status === 'blocked').length,
		totalRows: rows.length,
		counts,
		rows: rows.slice(0, homeLiveLimits.rows),
		updatedAt: works
			.map(({ item }) => isoTime(item.updated_at))
			.sort()
			.at(-1)!
	};
	return { project, omitted: rows.length - project.rows.length };
}

function byActivity(a: HomeWorkProject, b: HomeWorkProject) {
	return (
		b.running - a.running ||
		Number(b.rows.length > 0) - Number(a.rows.length > 0) ||
		b.updatedAt.localeCompare(a.updatedAt) ||
		a.agent.localeCompare(b.agent)
	);
}

/** Each run once, however many times the synced list repeats it. */
function runsByItem(runs: TrackerRunRecord[]) {
	const unique = new Map(runs.map((run) => [`${run.node ?? ''}:${run.id}`, run]));
	return Map.groupBy(unique.values(), (run) => run.item_id);
}

/** An item that may be described. One without a project is still work, so it is kept. */
function listed(item: TrackerItemRecord): IncludedTrackerItem | null {
	const named = { ...item, agent: item.agent || 'No project' };
	return isIncludedItem(named) ? named : null;
}

/**
 * @pure Every project, session and run these Tracker records hold. Private and ignored items are
 * never described; their live runs are only counted, so the totals stay honest.
 */
export function buildHomeLiveOverview(sources: TrackerSources, now: number): HomeLiveOverview {
	const offline = new Set(
		sources.machines.filter((entry) => entry.status === 'offline').map((entry) => entry.node)
	);
	const items = sources.items.flatMap((item) => listed(item) ?? []);
	const runs = runsByItem(sources.runs);
	const shown = new Set(items.map((item) => item.id));
	const hiddenRuns = [...runs]
		.filter(([id]) => !shown.has(id))
		.flatMap(([, own]) => own)
		.filter((run) => run.state === 'running' && run.ended_at === null).length;
	const built = [...Map.groupBy(items, (item) => item.agent)].map(([agent, own]) =>
		workProject(
			agent,
			own.map((item) => ({ item, runs: runs.get(item.id) ?? [], offline, now }))
		)
	);
	const projects = built.map((entry) => entry.project).sort(byActivity);
	return {
		readAt: new Date(now).toISOString(),
		projects: projects.slice(0, homeLiveLimits.projects),
		machines: sources.machines.map((entry) => ({
			name: homeText(entry.node, 200) ?? '',
			status: entry.status,
			...(entry.remoteRuns !== undefined && { remoteRuns: entry.remoteRuns })
		})),
		hiddenRuns,
		omittedRows:
			built.reduce((sum, entry) => sum + entry.omitted, 0) +
			projects.slice(homeLiveLimits.projects).reduce((sum, entry) => sum + entry.rows.length, 0)
	};
}
