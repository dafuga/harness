// @harness-uid u_4lnas6a65x
import type { TrackerProjectStatus } from '../TrackerItemReadRepository.types';
import { clipTrackerText } from './clipTrackerText';

const NOTE_LENGTH = 120;

/** @pure Render one project on one line: counts, then its ETA and latest note. */
export function formatTrackerProject(project: TrackerProjectStatus): string {
	const { eta, latest_note: note, phase4_workers: workers } = project;
	const phase4 = workers.total
		? ` (incl. ${workers.total} Phase 4 workers: ${countText(workers)})`
		: '';
	const progress = [
		eta && `ETA ${eta.due} [${eta.id.slice(0, 6)}]${eta.overdue ? ' (overdue)' : ''}`,
		note &&
			`latest ${note.at.slice(0, 10)} [${note.id.slice(0, 6)}]: ${clipTrackerText(note.text, NOTE_LENGTH)}`
	].filter(Boolean);
	return `  - ${project.project}: ${countText(project)}${phase4} · ${progress.join(' · ') || 'no ETA or note'}`;
}

function countText(counts: { in_progress: number; blocked: number; open: number }): string {
	return `${counts.in_progress} in progress, ${counts.blocked} blocked, ${counts.open} open`;
}
