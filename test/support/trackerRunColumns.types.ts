export interface RunColumnSource {
	path: string;
	text: string;
}

export interface RunColumnUsage {
	read: Set<string>;
	assigned: Set<string>;
}
