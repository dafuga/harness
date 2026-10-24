export interface GenerateUnitInput {
	name: string;
	kind?: string;
	responsibility?: string;
	force?: boolean;
	root?: string;
	group?: string;
	level?: 'molecule' | 'organism';
}
