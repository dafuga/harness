export interface SavedEntry {
	service: string;
	username: string;
	domain?: string;
}

export interface AccountMatchCase {
	service: string;
	site?: string;
	account?: string;
	entries: SavedEntry[];
}
