// @harness-uid u_st4dufvqxm
export interface PhoneItemSource {
	id: string;
	title: string;
	status: string;
	project: string | null;
	updated_at: string | null;
	due: string | null;
	needs_daniel: number;
	resolved: number;
	question: string | null;
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
	id: string;
	title: string;
	project: string;
	status: string;
	updatedAt: string | null;
	dueAt: string | null;
	attentionRevision: string;
	notes: { id: string; author: string; at: string; text: string }[];
	flag: { state: 'open' | 'resolved'; at: string | null; question: string } | null;
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
