export interface DocLink {
	line: number;
	target: string;
}

export interface DocFiles {
	exists: (path: string) => boolean;
	read: (path: string) => string;
}
