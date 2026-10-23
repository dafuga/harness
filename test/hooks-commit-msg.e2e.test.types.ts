export interface HookStatus {
	installed: boolean;
	enabled: boolean;
	stage: string;
	chained: boolean;
	stages: Array<{ stage: string; installed: boolean; chained: boolean; enabled: boolean }>;
	limitations: string[];
}
