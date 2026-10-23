export interface HookStatus {
	installed: boolean;
	enabled: boolean;
	stage: string;
	hooksDirectory: string;
	chained: boolean;
	limitations: string[];
}
