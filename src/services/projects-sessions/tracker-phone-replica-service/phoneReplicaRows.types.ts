// @harness-uid u_st4dufvqxm
import type {
	TrackerPlanning,
	TrackerPlanningFields,
	TrackerStage
} from '../../../utils/projects-sessions/trackerPlanning.types';
import type { TrackerReminderTime } from '../../../utils/projects-sessions/trackerUpcomingReminder.types';

export interface PhoneItemSource extends TrackerPlanningFields {
	id: string;
	title: string;
	status: string;
	agent: string | null;
	owner: string | null;
	kind: string | null;
	auto_launch: number | null;
	remind_at: string | null;
	every: string | null;
	project: string | null;
	updated_at: string | null;
	due: string | null;
	needs_daniel: number;
	resolved: number;
	question: string | null;
	options: string | null;
	confirm: string | null;
	attachments?: string | null;
	attachment_docs?: string | null;
	flag_clock: string | null;
	attention_clock: string;
}

export interface PhoneNoteSource {
	hlc: string;
	author: string | null;
	text: string | null;
}

export interface PhoneRunSource {
	item_id: string;
	id: string;
	origin: string;
	state: string;
	outcome: string | null;
	queued_at: number | null;
	started_at: number | null;
	ended_at: number | null;
}

export interface PhoneTrackerRow {
	stage: TrackerStage;
	planning: TrackerPlanning;
	id: string;
	title: string;
	project: string;
	status: string;
	updatedAt: string | null;
	dueAt: string | null;
	attentionRevision: string;
	reminder?: TrackerReminderTime;
	notes: { id: string; author: string; at: string; text: string }[];
	flag: {
		state: 'open' | 'resolved';
		at: string | null;
		question: string;
		options?: { label: string; effect: string; recommended?: true }[];
		confirm?: string;
	} | null;
	runs: {
		id: string;
		origin: string;
		state: string;
		outcome: string | null;
		queuedAt: number | null;
		startedAt: number | null;
		endedAt: number | null;
	}[];
}
