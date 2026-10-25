export interface HarnessApiOptions {
	url?: string;
	project?: string;
	mode?: 'local' | 'hosted';
	tokenEnv?: string;
	branch?: string;
	commit?: string;
	input?: string;
	query?: string[];
	select?: string;
	output?: string;
	timeout?: string;
	requestId?: string;
	viewport?: string;
	state?: string;
	scenario?: string;
	side?: 'before' | 'after';
	after?: string;
}

export interface ApiSnapshot {
	project: { id?: string };
	revision: { branch: string; commit: string; atTip: boolean };
	writable: boolean;
	capabilities?: { agents?: boolean; planning?: boolean };
	entities: Array<{ id: string; category?: string; [key: string]: unknown }>;
}
