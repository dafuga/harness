// @harness-uid u_rw64iex44n
export interface TrackerHandoff {
	tracker: string;
	role: 'orchestrator' | 'module worker';
	checkpoint: string;
	evidence: string;
}
