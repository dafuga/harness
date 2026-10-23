export interface Index {
	branches: Array<{ name: string; head: string }>;
	revisions: Array<{ commit: string; coverage: string; retained: boolean; branches: string[] }>;
}
