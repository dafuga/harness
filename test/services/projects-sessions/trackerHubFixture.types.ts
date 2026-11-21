export interface SignedHubInput {
	method: 'GET' | 'POST';
	path: string;
	text?: string;
	node?: string | null;
}
