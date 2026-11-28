export type Input = Record<string, unknown> & { projectId?: string; page?: number };

export interface HostedConnectionFixture {
	userCode: string;
	verificationUrl: string;
	expiresAt: string;
	interval: number;
	state: string;
	home: unknown;
	tracker: unknown;
}

export interface HostedHost {
	harness: Record<string, unknown>;
	__cache: (event: { projectId: string; status: string; cachedAt?: string }) => void;
	__hosted: { state: string; polls: number };
	__deny: boolean;
	__projects: {
		own: (op: string, input?: Input) => unknown;
		data: { ids: { tip: string }; projects: { entities: Record<string, unknown>[] }[] };
	};
}
