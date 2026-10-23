export type GroupName = 'Colors' | 'Font families' | 'Type scale' | 'Text styles' | 'Layout tokens';

export interface StyleToken {
	name: string;
	value: string;
	group: GroupName;
}
