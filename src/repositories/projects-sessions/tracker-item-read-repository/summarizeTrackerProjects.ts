// @harness-uid u_uic5j4k2vi
import type { SqliteDatabase } from '../../../core/development-tooling/sqliteTypes';
import { isTrackerPhase4Worker } from '../../../utils/projects-sessions/isTrackerPhase4Worker';
import type { TrackerItemRow, TrackerProjectStatus } from '../TrackerItemReadRepository.types';
import type { TrackerProjectNoteRow } from './summarizeTrackerProjects.types';

const AUTOMATED_NOTE =
	/^(?:watchdog\b|auto-launch\b|launch on \b|Closed (?:idle|finished) tmux\b)/i;

/** Read every unfinished project item, including snoozed ones the digest lists leave out. */
export function readTrackerProjectStatuses(
	database: SqliteDatabase,
	unfinished: string,
	now: number
) {
	const rows = database
		.prepare(`SELECT * FROM items WHERE ${unfinished}`)
		.all() as TrackerItemRow[];
	const notes = database
		.prepare(
			`SELECT item_id, hlc, text FROM item_notes
		 WHERE item_id IN (SELECT id FROM items WHERE ${unfinished}) ORDER BY hlc DESC`
		)
		.all() as TrackerProjectNoteRow[];
	return summarizeTrackerProjects(rows, notes, now);
}

/** @pure One status per project over every unfinished item. Notes must arrive newest first. */
export function summarizeTrackerProjects(
	rows: TrackerItemRow[],
	notes: TrackerProjectNoteRow[],
	nowMs: number
): TrackerProjectStatus[] {
	const projects = new Map<string, TrackerProjectStatus>();
	const noteOwners = new Map<string, TrackerProjectStatus>();
	const etaRows = new Map<TrackerProjectStatus, TrackerItemRow[]>();
	for (const row of rows) {
		const worker = isTrackerPhase4Worker(row.title, row.owner);
		const name = worker ? 'harness' : projectName(row);
		const project = projects.get(name) ?? emptyProject(name);
		projects.set(name, project);
		countItem(project, row.status, worker);
		if (worker) continue;
		noteOwners.set(row.id, project);
		if (hasEta(row)) etaRows.set(project, [...(etaRows.get(project) ?? []), row]);
	}
	for (const [project, candidates] of etaRows) project.eta = pickEta(candidates, nowMs);
	addLatestNotes(noteOwners, notes);
	return [...projects.values()].sort((a, b) => a.project.localeCompare(b.project));
}

function projectName({ agent, project }: TrackerItemRow): string {
	return [agent, project].find(Boolean) ?? 'unassigned';
}

function hasEta(row: TrackerItemRow): boolean {
	return row.status === 'in_progress' && Boolean(row.due) && !row.every;
}

function emptyProject(project: string): TrackerProjectStatus {
	const counts = { in_progress: 0, blocked: 0, open: 0 };
	return { project, ...counts, phase4_workers: { total: 0, ...counts } };
}

function countItem(project: TrackerProjectStatus, status: string | null, worker: boolean) {
	const key = status === 'in_progress' || status === 'blocked' ? status : 'open';
	project[key] += 1;
	if (!worker) return;
	project.phase4_workers.total += 1;
	project.phase4_workers[key] += 1;
}

/** The soonest upcoming due time, else the most recently missed one. */
function pickEta(rows: TrackerItemRow[], nowMs: number): TrackerProjectStatus['eta'] {
	const timed = rows
		.map((row) => ({ id: row.id, due: row.due!, at: dueEnd(row.due!) }))
		.sort((a, b) => a.at - b.at);
	const upcoming = timed.find(({ at }) => at >= nowMs);
	const { id, due } = upcoming ?? timed[timed.length - 1];
	return { id, due, overdue: !upcoming };
}

/** A date-only due value lasts through its day. */
function dueEnd(due: string): number {
	return Date.parse(due.length === 10 ? `${due}T23:59:59.999Z` : due);
}

function addLatestNotes(owners: Map<string, TrackerProjectStatus>, notes: TrackerProjectNoteRow[]) {
	for (const { item_id: id, hlc, text } of notes) {
		const project = owners.get(id);
		const at = Number(hlc.split('-')[0]);
		if (!project || project.latest_note || !at || AUTOMATED_NOTE.test(text)) continue;
		project.latest_note = { id, at: new Date(at).toISOString(), text };
	}
}
