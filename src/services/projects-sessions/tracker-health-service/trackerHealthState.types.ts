// @harness-uid u_6ll3be262q
export interface TrackerHealthState {
	item_id?: string;
	item_open?: boolean;
	webhook_failed?: number;
	checks: Record<string, { ok: boolean; last_alert?: number; last_fallback?: number }>;
}
