export type LaunchRequestStatus = 'queued' | 'waiting' | 'started' | 'refused' | 'withdrawn';

export interface LaunchRequestState {
	status: LaunchRequestStatus;
	reason?: string;
	computer?: string | null;
	attempt?: number | null;
}
