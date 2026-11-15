// @harness-uid u_ty3of47ntv
export interface DocLink {
	line: number;
	target: string;
}

export interface DocFiles {
	exists: (path: string) => boolean;
	read: (path: string) => string;
}
