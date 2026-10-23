import type { SearchEntry } from '../src/utils/entitySearch';

export type Row = [
	id: string,
	category: SearchEntry['category'],
	name: string,
	purpose: string,
	terms?: string[]
];
