// @harness-uid u_im4swoqn6p
export interface TrackerBackupState {
	first_seen: string | null;
	last_ok: string | null;
	last_ok_file: string | null;
	last_ok_size: number | null;
	last_error: string | null;
	last_error_at: string | null;
	last_scheduled_day: string | null;
	stale_flagged_for: string | null;
	alert_item: string | null;
}
