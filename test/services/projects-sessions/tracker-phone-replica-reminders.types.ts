export type ReminderRow = {
	status: string;
	attentionRevision: string;
	reminder?: { at: string; repeats: string | null };
	flag: { options?: unknown[] } | null;
};
