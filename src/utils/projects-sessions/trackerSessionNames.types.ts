export interface TrackerNamedItem {
	id: string;
	title?: string | null;
	owner?: string | null;
	project?: string | null;
	agent?: string | null;
}

export interface TrackerTmuxWindow {
	session: string;
	window: string;
}
