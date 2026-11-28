// @harness-uid u_rhat43dtk7
export interface TrackerHostWorkClaim {
	run: number;
	lease: string;
	host: string;
	kind: 'ssh' | 'colima';
}
