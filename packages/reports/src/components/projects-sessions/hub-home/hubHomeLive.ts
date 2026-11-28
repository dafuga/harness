// @harness-uid u_uioji3kibg
import type {
	HomeLiveOverview,
	HomeWorkProject,
	HomeWorkRow,
	HomeWorkState
} from '$reports/lib/projects-sessions/hub-home/homeLive.types';
import type { LinkedHome } from '$reports/lib/projects-sessions/hub-home/homeLive.types';
import { count } from './hubHomePresentation';
import { runMoment } from './hubHomeTime';

export const stageLabels = {
	idea: 'Idea',
	detail: 'Detailed idea',
	design: 'Full design',
	build: 'Implementation'
} as const;

export const workStateLabels: Record<HomeWorkState, string> = {
	running: 'Running',
	offline: 'Computer offline',
	queued: 'Queued',
	blocked: 'Blocked',
	finished: 'Finished'
};

const outcomes: Record<string, string> = {
	done: 'done',
	abandoned: 'abandoned',
	timed_out: 'timed out',
	blocked: 'blocked'
};

export const statusWords = {
	open: 'Open',
	in_progress: 'In progress',
	blocked: 'Blocked',
	done: 'Done'
} as const;

/** @pure A planning stage worth showing; the default 'idea' says nothing about the work. */
export function stageLabel(stage: HomeWorkRow['stage']) {
	return stage && stage !== 'idea' ? `Stage: ${stageLabels[stage]}` : null;
}

/** @pure The run state in words, with the recorded outcome of the latest run when it has one. */
export function workStateLabel(row: HomeWorkRow) {
	const { state, outcome } = row;
	if (state === 'queued' && row.runId) return `Queued #${row.runId.toLocaleString('en-US')}`;
	const ended = state === 'finished' && outcome && (outcomes[outcome] ?? outcome);
	return ended ? `Finished: ${ended}` : workStateLabels[state];
}

/** @pure A length of time in its largest whole unit. */
export function span(from: string, now: number) {
	const minutes = Math.max(0, Math.floor((now - Date.parse(from)) / 60_000));
	if (minutes < 1) return 'under 1m';
	if (minutes < 60) return `${minutes}m`;
	return minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
}

/** @pure Relative time since Tracker updated this item. */
export function updatedWorkAge(updatedAt: string, now: number) {
	return `updated ${span(updatedAt, now)} ago`;
}

/** @pure How long this run has been going or waiting, and how long since Tracker changed it. */
export function workAge(row: HomeWorkRow, now: number) {
	const { state, startedAt, updatedAt } = row;
	const updated = updatedWorkAge(updatedAt, now);
	if (!startedAt || state === 'finished') return updated;
	if (state === 'running') return `running ${span(startedAt, now)} · ${updated}`;
	const since = state === 'queued' ? 'queued' : 'started';
	return `${since} ${span(startedAt, now)} ago · ${updated}`;
}

/** @pure The exact start or queue time and last Tracker change, in Lisbon time. */
export function workTimes(row: HomeWorkRow): string {
	const { state, startedAt, updatedAt } = row;
	const updated = `updated ${runMoment(updatedAt)}, Lisbon time`;
	if (!startedAt) return `Updated ${runMoment(updatedAt)}, Lisbon time`;
	return `${state === 'queued' ? 'Queued' : 'Started'} ${runMoment(startedAt)} · ${updated}`;
}

/** @pure Who, where and with what, saying so when Tracker does not know. */
export function workFacts(row: HomeWorkRow) {
	const { owner, computer, model } = row;
	return [owner ?? 'No owner', computer ?? 'No computer yet', model ?? 'Model not reported'];
}

export function liveSummary(overview: HomeLiveOverview) {
	const running = overview.projects.reduce((sum, project) => sum + project.running, 0);
	const computers = new Set(
		overview.projects.flatMap((project) =>
			project.rows.filter((row) => row.state === 'running').map((row) => row.computer)
		)
	).size;
	const where = running ? ` on ${count(computers, 'computer')}` : '';
	return `${count(running, 'run')} live${where} · ${count(overview.projects.length, 'project')}`;
}

/** Current work counts include rows beyond the snapshot limit when the linked Mac reports them. */
export function projectWorkCounts(project: HomeWorkProject) {
	const running = project.running;
	const blocked =
		project.blockedRows ??
		Math.max(
			0,
			project.counts.blocked -
				project.rows.filter((row) => row.state === 'running' && row.status === 'blocked').length
		);
	const waiting = project.rows.filter(
		({ state }) => state === 'queued' || state === 'offline'
	).length;
	const resting = project.waitingRows ?? waiting;
	return { running, blocked, resting };
}

/** @pure Why there is no overview to show, or null when there is one. */
export function liveNotice(reading: LinkedHome | null): string | null {
	if (!reading) return 'Reading your linked computers…';
	if (reading.unlisted)
		return 'Your linked computers could not be listed. They are read again while this page is open.';
	if (!reading.linked)
		return 'No computer is linked to this account. This overview comes straight from your Mac over an encrypted connection.';
	if (!reading.answered)
		return 'No linked computer answered, so nothing here is current. Open Harness on your Mac to see what is running.';
	if (reading.snapshot?.liveOverview) return null;
	return reading.snapshot?.overview.status === 'ready'
		? 'Update Harness on your Mac to see every project, session and run.'
		: 'Your Mac answered but could not read Tracker. Check that Tracker is running on it.';
}

/** @pure Reports live-data failures that need a prominent Home alert. */
export function liveSystemNotice(reading: LinkedHome | null): string | null {
	const failure =
		reading?.unlisted ||
		(Boolean(reading?.linked) && !reading?.answered) ||
		reading?.snapshot?.overview.status === 'unavailable';
	return failure ? liveNotice(reading) : null;
}
