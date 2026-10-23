export interface FixtureServer {
	url: string;
	close(): Promise<void>;
}

export type Reply = { status: number; body: string } | 'hang';
