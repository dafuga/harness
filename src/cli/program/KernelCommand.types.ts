export interface Flags {
	json?: boolean;
	quick?: boolean;
	boundary?: boolean;
	write?: boolean | string;
	measurements?: string;
	runtime: string;
	port: string;
	nodes: string;
	seed: string;
	url?: string;
}
