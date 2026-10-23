export type Sample = {
	status: string;
	sampledAt: string;
	machinePercent: number;
	groups: Array<{ id: string; label: string; machinePercent: number; processes: number }>;
	agents: unknown[];
};
