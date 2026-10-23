export interface Change {
	path: string;
	action: string;
	reason: string;
	before: { sha256: string; saved: string };
	after: { sha256: string } | null;
}

export interface Installed {
	written: string[];
	kept: string[];
	changes: Change[];
}
