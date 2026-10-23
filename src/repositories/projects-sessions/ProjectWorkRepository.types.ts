export interface Checkout {
	path: string;
	branch: string | null;
	head: string | null;
	primary: boolean;
}

export interface PathChange {
	path: string;
	status: string;
}
