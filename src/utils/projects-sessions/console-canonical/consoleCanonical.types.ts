/** The parts of a history index that say where a commit is. */
export interface IndexedHistory {
	branches: Array<{ name: string; head: string }>;
	revisions: Array<{ commit: string; branches: string[]; retained?: boolean }>;
}
