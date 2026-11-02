// @harness-uid u_fr4fss7mlm
export interface GenerateUnitInput {
	name: string;
	kind?: string;
	responsibility?: string;
	force?: boolean;
	root?: string;
	group?: string;
	level?: 'molecule' | 'organism';
}
